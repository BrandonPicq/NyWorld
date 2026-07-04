import type { GameCommand } from "./commands";
import type {
  DialogueNode,
  Inventory,
  Item,
  Npc,
  Position,
  Renderable,
  Stats,
  Quests,
} from "./components";
import {
  getQuestDef,
  getAllQuestDefs,
  hasQuestDef,
} from "./quests/questRegistry";
import { getDialogue } from "./dialogues/dialogueRegistry";
import { getItemDef } from "./items/itemRegistry";
import { getAllNpcPresenceDefs } from "./npcs/npcPresenceRegistry";
import {
  cloneNpcState,
  createNpcStateMapFromSave,
  createInitialNpcState,
  createInitialNpcStateMap,
  type NpcState,
  type NpcStateMap,
} from "./npcs/NpcState";
import { spawnNpcsInWorld, spawnItemsInWorld } from "./spawner/EntitySpawner";
import { serializeSaveData } from "./save/gameSaveSerializer";
import { World } from "./ecs/World";
import type { EntityId } from "./ecs/types";
import { GameMap } from "./GameMap";
import type { LogEntry } from "./LogEntry";
import { DIRECTION_DELTA, MovementSystem } from "./systems/MovementSystem";
import type { Direction } from "./systems/MovementSystem";
import { NpcScheduleSystem } from "./systems/NpcScheduleSystem";
import { TickCounter } from "./tick";
import type {
  NpcScheduleEntryData,
  NpcSpawnData,
  ZoneTransitionData,
} from "./ZoneTypes";
import type { GameSaveData } from "./GameSaveData";
import type {
  ActionTuningConfig,
  NewGameConfig,
  SafeRespawnPoint,
} from "./content/contentBundle";
import { createStartingInventory } from "./newGameState";
import {
  START_WORLD_TIME_MINUTES,
  WORLD_TIME_ACTION_COST,
  createWorldTimeSnapshot,
  type WorldTimeSnapshot,
} from "./time/WorldCalendar";
import {
  cloneStats,
  createInitialStats,
  getStatValue,
  refreshDerivedStats,
} from "./stats/characterStats";
import {
  CombatSystem,
  isCombatNpc,
  type CombatState,
} from "./combat/CombatSystem";

export type { CombatState } from "./combat/CombatSystem";

export type EngineEffect =
  | {
      type: "ItemCollected";
      itemId: string;
      quantity: number;
      source?: "ground" | "reward";
    }
  | {
      type: "ItemLost";
      itemId: string;
      quantity: number;
      source?: "quest_turn_in";
    }
  | {
      type: "ItemUsed";
      itemId: string;
      energyRestored?: number;
      hpRestored?: number;
    }
  | {
      type: "ItemUseRejected";
      itemId: string;
      reason: "energy_full" | "no_effect";
      message: string;
    };

export interface EngineNotice {
  title: string;
  message: string;
}

/**
 * Result of applying one explicit player command to the simulation.
 */
export interface ExecuteResult {
  success: boolean;
  dialogue?: DialogueNode[];
  dialogueId?: string;
  effects?: EngineEffect[];
}

/**
 * Render-ready entity projection exposed through a game snapshot.
 */
export interface RenderEntity {
  x: number;
  y: number;
  glyph: string;
  color: string;
  npcId?: string;
  name?: string;
}

/**
 * Immutable UI-facing view of the current game state.
 *
 * React and rendering code consume snapshots instead of mutating ECS state
 * directly.
 */
export interface GameSnapshot {
  tick: number;
  worldTime: WorldTimeSnapshot;
  zoneId: string;
  zoneName: string;
  mapWidth: number;
  mapHeight: number;
  playerX: number;
  playerY: number;
  playerFacing: Direction;
  tiles: number[][];
  log: LogEntry[];
  stats: Stats;
  inventory: Inventory;
  npcStates: NpcState[];
  entities: RenderEntity[];
  entryDialogue: DialogueNode[];
  activeQuests: Array<{
    questId: string;
    name: string;
    description: string;
    state: "active" | "readyToComplete";
    objectives: Array<{
      id: string;
      description: string;
      type: string;
      itemId?: string;
      npcId?: string;
      requiredQuantity: number;
      currentQuantity: number;
    }>;
    targetNpcId: string;
    rewards: { currency?: number; items?: Array<{ itemId: string; quantity: number }> };
  }>;
  completedQuests: string[];
  combatState?: CombatState;
}

const COMMAND_DIRECTION: Record<string, Direction> = {
  MoveNorth: "north",
  MoveSouth: "south",
  MoveWest: "west",
  MoveEast: "east",
};

const INTERACTION_DIRECTIONS: Direction[] = ["north", "east", "south", "west"];

/**
 * Fallback action tuning used when no authored config is injected, so tests
 * and isolated engine instances remain self-contained.
 */
const DEFAULT_ACTION_TUNING: ActionTuningConfig = {
  rest: { energyRestore: 15 },
  study: { energyCost: 10, academicProgressGain: 15, intelligenceGain: 1 },
};

type ZoneResolver = (zoneId: string) => GameMap | undefined;

type GameplayEngineOptions = {
  resolveZone?: ZoneResolver;
  /**
   * Optional authored recovery point. When omitted, the engine falls back to the
   * initial map's playerStart so tests and isolated engine instances remain
   * self-contained.
   */
  safeRespawn?: SafeRespawnPoint;
  /**
   * Optional authored starting state for fresh playthroughs. Saves restore the
   * full player state, so restored engines ignore this config.
   */
  newGame?: NewGameConfig;
  /** Optional authored tuning for rest and study actions. */
  actions?: ActionTuningConfig;
  random?: () => number;
};

/**
 * Owns the mutable game simulation state.
 *
 * React should interact with this class only through explicit commands and
 * snapshots so gameplay rules stay independent from rendering and UI state.
 */
export class GameplayEngine {
  private readonly world = new World();
  private readonly tickCounter = new TickCounter();
  private map: GameMap;

  private log: LogEntry[] = [];
  private playerFacing: Direction = "south";
  private pickedUpItemSpawnKeys = new Set<string>();
  private resolveZone?: ZoneResolver;
  private worldTimeMinutes = START_WORLD_TIME_MINUTES;
  private npcStates: NpcStateMap = createInitialNpcStateMap();
  private pendingDialogueCompletionId?: string;
  private pendingZoneEntryDialogue: DialogueNode[] = [];
  private seenZoneEntryEventIds = new Set<string>();
  private notices: EngineNotice[] = [];
  private readonly combat: CombatSystem;
  private readonly safeRespawn: SafeRespawnPoint;
  private readonly actionTuning: ActionTuningConfig;

  constructor(map: GameMap, options: GameplayEngineOptions = {}) {
    this.map = map;
    this.resolveZone = options.resolveZone;
    this.actionTuning = options.actions ?? DEFAULT_ACTION_TUNING;
    this.safeRespawn = options.safeRespawn ?? {
      zoneId: map.zoneId,
      x: map.playerStart.x,
      y: map.playerStart.y,
    };
    this.combat = new CombatSystem({
      world: this.world,
      getPlayerStats: () => this.getPlayerStats(),
      getPlayerInventory: () => this.getPlayerInventory(),
      addLog: (message) => this.addLog(message),
      recordNpcDefeat: (npcId) => this.recordNpcDefeat(npcId),
      recoverPlayerFromDefeat: () => this.recoverPlayerFromCombatDefeat(),
      random: options.random,
    });

    const playerId = this.world.createEntity();

    const position = {
      type: "Position" as const,
      x: map.playerStart.x,
      y: map.playerStart.y,
    };
    this.world.addComponent(playerId, position);

    const playerControlled = { type: "PlayerControlled" as const };
    this.world.addComponent(playerId, playerControlled);

    const renderable = {
      type: "Renderable" as const,
      glyph: "@",
      color: "#ffcc00",
    };
    this.world.addComponent(playerId, renderable);

    this.world.addComponent(playerId, createInitialStats(options.newGame));
    this.world.addComponent(playerId, createStartingInventory(options.newGame));

    const quests: Quests = {
      type: "Quests",
      active: [],
      completed: [],
      completedObjectives: [],
    };
    this.world.addComponent(playerId, quests);

    this.spawnNpcs();
    this.spawnItems();

    this.addLog(`Entered ${map.name}.`);
    this.queueZoneEntryDialogue(map);
  }

  private spawnNpcs(): void {
    spawnNpcsInWorld(this.world, this.getCurrentZoneNpcSpawns(), this.npcStates);

    NpcScheduleSystem.apply(
      this.world,
      this.map,
      this.getScheduledNpcSpawns(),
      this.worldTimeMinutes,
    );
  }

  private spawnItems(): void {
    spawnItemsInWorld(
      this.world,
      this.map.items,
      this.pickedUpItemSpawnKeys,
      this.map.zoneId,
    );
  }

  /**
   * Applies one player command and returns any immediate UI-facing result.
   *
   * Movement commands update facing and may fail without advancing time when
   * blocked by map geometry or an NPC dialogue collision. Interact checks
   * nearby or direction-limited tiles for contextual actions without moving.
   */
  execute(command: GameCommand): ExecuteResult {
    if (this.combat.hasActiveCombat()) {
      return this.combat.execute(command);
    }

    if (command.type === "Rest") {
      this.restPlayer();
      return { success: true };
    }

    if (command.type === "Study") {
      return this.studyPlayer();
    }

    if (command.type === "Interact") {
      return this.interact(command.targetNpcId, command.targetDirection);
    }

    if (command.type === "UseItem") {
      return this.useItem(command.itemId);
    }

    if (command.type === "CompleteDialogue") {
      const dialogueId = this.pendingDialogueCompletionId;
      this.pendingDialogueCompletionId = undefined;

      if (!dialogueId) {
        return { success: false };
      }

      const effects: EngineEffect[] = [];
      for (const questDef of getAllQuestDefs()) {
        if (questDef.triggers.start.dialogueId === dialogueId) {
          this.startQuest(questDef.questId);
        }
        if (questDef.triggers.complete.dialogueId === dialogueId) {
          effects.push(...this.completeQuest(questDef.questId));
        }
      }
      return effects.length > 0
        ? { success: true, effects }
        : { success: true };
    }

    if (command.type === "AcknowledgeZoneEntryDialogue") {
      if (this.pendingZoneEntryDialogue.length === 0) {
        return { success: false };
      }

      this.pendingZoneEntryDialogue = [];
      return { success: true };
    }

    const direction = COMMAND_DIRECTION[command.type];

    if (!direction) {
      return { success: false };
    }

    this.playerFacing = direction;

    const stats = this.getPlayerStats();
    if (stats.resources.energy <= 0) {
      this.addLog(
        "You are too exhausted to move! Rest [R] to recover energy.",
      );
      return { success: false };
    }

    const positionBefore = this.getPlayerPosition();
    const target = this.getTargetPosition(positionBefore, direction);

    const blockingNpc = this.getNpcAt(target.x, target.y);
    if (blockingNpc) {
      if (isCombatNpc(blockingNpc.npcId)) {
        return this.combat.startCombat(blockingNpc);
      }
      return this.talkToNpc(blockingNpc, false);
    }

    const moved = MovementSystem.move(this.world, direction, this.map);

    if (moved) {
      this.tickCounter.advance();
      this.advanceWorldTime(WORLD_TIME_ACTION_COST.movement);
      stats.resources.energy = Math.max(0, stats.resources.energy - 1);
      const pos = this.getPlayerPosition();
      this.addLog(`Moved ${direction} to (${pos.x}, ${pos.y}).`);
      this.checkCoordinateObjectives();
      const itemAtPosition = this.getItemAt(pos.x, pos.y);
      const effects: EngineEffect[] = [];
      if (itemAtPosition) {
        effects.push(
          this.pickupItem(itemAtPosition.entity, itemAtPosition.component),
        );
      }
      this.resolvePendingTransition();
      return effects.length > 0
        ? { success: true, effects }
        : { success: true };
    }

    this.addLog(
      `Cannot move ${direction} — blocked at (${target.x}, ${target.y}).`,
    );

    return { success: false };
  }

  private interact(
    targetNpcId?: string,
    targetDirection?: Direction,
  ): ExecuteResult {
    const playerPosition = this.getPlayerPosition();
    const adjacentNpcs: Npc[] = [];
    const directionsToCheck = targetDirection
      ? [targetDirection]
      : INTERACTION_DIRECTIONS;

    for (const direction of directionsToCheck) {
      const target = this.getTargetPosition(playerPosition, direction);
      const npc = this.getNpcAt(target.x, target.y);

      if (npc) {
        adjacentNpcs.push(npc);
      }
    }

    if (adjacentNpcs.length === 0) {
      this.addLog(
        targetDirection
          ? "There is nothing to interact with there."
          : "There is nothing to interact with nearby.",
      );
      return { success: false };
    }

    if (targetNpcId) {
      const targetNpc = adjacentNpcs.find((n) => n.npcId === targetNpcId);
      if (targetNpc) {
        if (isCombatNpc(targetNpc.npcId)) {
          return this.combat.startCombat(targetNpc);
        }
        return this.talkToNpc(targetNpc, true);
      }

      this.addLog("That interaction target is no longer nearby.");
      return { success: false };
    }

    const firstNpc = adjacentNpcs[0];
    if (isCombatNpc(firstNpc.npcId)) {
      return this.combat.startCombat(firstNpc);
    }
    return this.talkToNpc(firstNpc, true);
  }

  private getNpcAt(x: number, y: number): Npc | undefined {
    const npcEntities = this.world.entitiesWith("Position", "Npc");

    for (const npcEntityId of npcEntities) {
      const npcPos = this.world.getComponent<Position>(npcEntityId, "Position")!;

      if (npcPos.x === x && npcPos.y === y) {
        return this.world.getComponent<Npc>(npcEntityId, "Npc")!;
      }
    }

    return undefined;
  }

  private getItemAt(
    x: number,
    y: number,
  ): { entity: EntityId; component: Item } | undefined {
    const itemEntities = this.world.entitiesWith("Position", "Item");

    for (const itemEntityId of itemEntities) {
      const itemPos = this.world.getComponent<Position>(itemEntityId, "Position")!;

      if (itemPos.x === x && itemPos.y === y) {
        const component = this.world.getComponent<Item>(itemEntityId, "Item")!;
        return { entity: itemEntityId, component };
      }
    }

    return undefined;
  }

  private pickupItem(entity: EntityId, item: Item): EngineEffect {
    const def = getItemDef(item.itemId);
    const inventory = this.getPlayerInventory();
    const existingStack = inventory.items.find(
      (stack) => stack.itemId === item.itemId,
    );

    if (existingStack) {
      existingStack.quantity += item.quantity;
    } else {
      inventory.items.push({
        itemId: item.itemId,
        quantity: item.quantity,
      });
    }

    this.world.destroyEntity(entity);
    this.pickedUpItemSpawnKeys.add(item.spawnKey);

    this.addLog(
      `Picked up ${def.name}${item.quantity > 1 ? ` x${item.quantity}` : ""}.`,
    );

    return {
      type: "ItemCollected",
      itemId: item.itemId,
      quantity: item.quantity,
    };
  }

  private useItem(itemId: string): ExecuteResult {
    const inventory = this.getPlayerInventory();
    const stackIndex = inventory.items.findIndex(
      (stack) => stack.itemId === itemId,
    );

    if (stackIndex === -1) {
      this.addLog("You don't have that item.");
      return { success: false };
    }

    const def = getItemDef(itemId);

    if (def.category !== "consumable") {
      this.addLog(`${def.name} cannot be used.`);
      return { success: false };
    }

    const energyRestored = def.effects?.energyRestore;

    if (energyRestored === undefined) {
      const message = `${def.name} has no usable effect yet.`;
      this.addLog(message);
      return {
        success: false,
        effects: [
          { type: "ItemUseRejected", itemId, reason: "no_effect", message },
        ],
      };
    }

    const stats = this.getPlayerStats();
    if (stats.resources.energy >= stats.resources.maxEnergy) {
      const message = `${def.name} would have no effect right now.`;
      this.addLog(message);
      return {
        success: false,
        effects: [
          { type: "ItemUseRejected", itemId, reason: "energy_full", message },
        ],
      };
    }

    const nextEnergy = Math.min(
      stats.resources.maxEnergy,
      stats.resources.energy + energyRestored,
    );
    const actualEnergyRestored = nextEnergy - stats.resources.energy;
    stats.resources.energy = nextEnergy;

    const stack = inventory.items[stackIndex];
    stack.quantity -= 1;

    if (stack.quantity <= 0) {
      inventory.items.splice(stackIndex, 1);
    }

    this.tickCounter.advance();
    this.advanceWorldTime(WORLD_TIME_ACTION_COST.useItem);
    this.addLog(`Used ${def.name}. Recovered ${actualEnergyRestored} energy.`);

    return {
      success: true,
      effects: [
        { type: "ItemUsed", itemId, energyRestored: actualEnergyRestored },
      ],
    };
  }

  private talkToNpc(
    npc: Npc,
    success: boolean,
  ): ExecuteResult {
    const resolved = this.resolveNpcDialogue(npc.npcId, npc.dialogueId);
    this.pendingDialogueCompletionId = resolved.dialogueId;

    this.advanceWorldTime(WORLD_TIME_ACTION_COST.dialogue);
    this.addLog(`Talked to ${npc.name}.`);

    return {
      success,
      dialogue: resolved.nodes,
      dialogueId: resolved.dialogueId,
    };
  }

  /**
   * Returns the transition located under the player, if the current tile has one.
   */
  getPendingTransition(): ZoneTransitionData | undefined {
    const pos = this.getPlayerPosition();
    return this.map.getTransitionAt(pos.x, pos.y);
  }

  /**
   * Moves the existing player entity into another map and respawns map-owned NPCs and items.
   */
  enterZone(map: GameMap, entryX: number, entryY: number): void {
    this.map = map;
    this.spawnNpcs();
    this.spawnItems();

    const pos = this.getPlayerPosition();
    pos.x = entryX;
    pos.y = entryY;

    this.addLog(`Entered ${map.name}.`);
    this.queueZoneEntryDialogue(map);
    this.checkCoordinateObjectives();
  }

  private queueZoneEntryDialogue(map: GameMap): void {
    if (map.entryDialogue.length === 0) {
      this.pendingZoneEntryDialogue = [];
      return;
    }

    const eventId = getZoneEntryEventId(map.zoneId);
    if (this.seenZoneEntryEventIds.has(eventId)) {
      this.pendingZoneEntryDialogue = [];
      return;
    }

    this.seenZoneEntryEventIds.add(eventId);
    this.pendingZoneEntryDialogue = map.entryDialogue.map((dialogue) => ({
      ...dialogue,
    }));
  }

  /**
   * Serializes the current engine state into a versioned save payload.
   *
   * The save only captures mutable gameplay state — zone identity, position,
   * stats, inventory, log, world time, and collected item keys. Zone geometry,
   * NPCs, and ground items are rehydrated from content data when the save is
   * restored.
   */
  createSaveData(): GameSaveData {
    return serializeSaveData({
      zoneId: this.map.zoneId,
      tick: this.tickCounter.tick,
      worldTimeMinutes: this.worldTimeMinutes,
      playerPosition: this.getPlayerPosition(),
      playerFacing: this.playerFacing,
      stats: this.getPlayerStats(),
      inventory: this.getPlayerInventory(),
      npcStates: Object.values(this.npcStates),
      log: this.log,
      pickedUpItemSpawnKeys: this.pickedUpItemSpawnKeys,
      seenZoneEntryEventIds: this.seenZoneEntryEventIds,
      activeQuests: this.getPlayerQuests().active,
      completedQuests: this.getPlayerQuests().completed,
      completedObjectives: this.getPlayerQuests().completedObjectives,
    });
  }

  static fromSaveData(
    saveData: GameSaveData,
    options: GameplayEngineOptions & { resolveZone: ZoneResolver },
  ): GameplayEngine {
    const map = options.resolveZone(saveData.zoneId);

    if (!map) {
      throw new Error(
        `Cannot load save: zone "${saveData.zoneId}" is not available.`,
      );
    }

    const engine = new GameplayEngine(map, options);
    engine.restoreSaveData(saveData);
    return engine;
  }

  private restoreSaveData(saveData: GameSaveData): void {
    const [playerId] = this.world.entitiesWith("PlayerControlled");

    const stats = this.world.getComponent<Stats>(playerId, "Stats")!;
    stats.resources = { ...saveData.stats.resources };
    stats.currency = saveData.stats.currency;
    stats.attributes = { ...saveData.stats.attributes };
    stats.combat = { ...saveData.stats.combat };
    stats.skills = { ...saveData.stats.skills };
    stats.progression = { ...saveData.stats.progression };
    stats.conditions = [...saveData.stats.conditions];
    refreshDerivedStats(stats);

    const inventory = this.world.getComponent<Inventory>(
      playerId,
      "Inventory",
    )!;
    inventory.items = saveData.inventory.items.map((stack) => ({ ...stack }));

    const quests = this.world.getComponent<Quests>(playerId, "Quests")!;
    const restoredQuests = this.restoreQuestIds(
      saveData.activeQuests,
      saveData.completedQuests,
    );
    quests.active = restoredQuests.active;
    quests.completed = restoredQuests.completed;
    quests.completedObjectives = normalizeCompletedObjectiveKeys(
      saveData.completedObjectives || [],
      quests.active,
    );

    this.tickCounter.restoreTo(saveData.tick);
    this.worldTimeMinutes = saveData.worldTimeMinutes;
    this.npcStates = createNpcStateMapFromSave(saveData.npcStates);
    this.playerFacing = saveData.playerFacing;
    this.log = saveData.log.map((entry) => ({ ...entry }));
    this.pickedUpItemSpawnKeys = new Set(saveData.pickedUpItemSpawnKeys);
    this.seenZoneEntryEventIds = new Set(saveData.seenZoneEntryEventIds ?? []);
    this.pendingZoneEntryDialogue = [];

    const pos = this.getPlayerPosition();
    pos.x = saveData.playerX;
    pos.y = saveData.playerY;

    this.spawnNpcs();
    this.spawnItems();
    this.seenZoneEntryEventIds.add(getZoneEntryEventId(this.map.zoneId));
  }

  private resolvePendingTransition(): void {
    const transition = this.getPendingTransition();

    if (!transition || !this.resolveZone) {
      return;
    }

    const nextMap = this.resolveZone(transition.targetZoneId);

    if (!nextMap) {
      this.addLog(`Cannot enter missing zone ${transition.targetZoneId}.`);
      return;
    }

    this.enterZone(nextMap, transition.targetX, transition.targetY);
  }

  private restPlayer(): void {
    const { energyRestore } = this.actionTuning.rest;
    const stats = this.getPlayerStats();
    stats.resources.energy = Math.min(
      stats.resources.maxEnergy,
      stats.resources.energy + energyRestore,
    );
    this.tickCounter.advance();
    this.advanceWorldTime(WORLD_TIME_ACTION_COST.rest);
    this.addLog(`Rested and recovered ${energyRestore} energy.`);
  }

  private studyPlayer(): ExecuteResult {
    const { energyCost, academicProgressGain, intelligenceGain } =
      this.actionTuning.study;
    const stats = this.getPlayerStats();

    if (stats.resources.energy < energyCost) {
      this.addLog("You are too exhausted to study. Rest [R] to recover energy.");
      return { success: false };
    }

    stats.resources.energy = Math.max(0, stats.resources.energy - energyCost);
    stats.progression.academicProgress = Math.min(
      100,
      stats.progression.academicProgress + academicProgressGain,
    );
    stats.attributes.intelligence =
      (stats.attributes.intelligence ?? 0) + intelligenceGain;
    stats.skills.scholarship += academicProgressGain;
    refreshDerivedStats(stats);

    this.tickCounter.advance();
    this.advanceWorldTime(WORLD_TIME_ACTION_COST.study);
    this.addLog(
      `Studied old notes. Intelligence +${intelligenceGain}, scholarship +${academicProgressGain}, academic progress +${academicProgressGain}%.`,
    );

    return { success: true };
  }

  private advanceWorldTime(minutes: number): void {
    this.worldTimeMinutes += minutes;
    NpcScheduleSystem.apply(
      this.world,
      this.map,
      this.getScheduledNpcSpawns(),
      this.worldTimeMinutes,
    );
  }

  private addLog(message: string): void {
    this.log.push({
      tick: this.tickCounter.tick,
      worldTimeMinutes: this.worldTimeMinutes,
      message,
    });
  }

  /**
   * Builds an immutable snapshot for React and render adapters.
   */
  getSnapshot(): GameSnapshot {
    const pos = this.getPlayerPosition();
    const stats = this.getPlayerStats();
    const tiles: number[][] = [];

    for (let y = 0; y < this.map.height; y++) {
      const row: number[] = [];
      for (let x = 0; x < this.map.width; x++) {
        row.push(this.map.getTileId(x, y));
      }
      tiles.push(row);
    }

    const entities: RenderEntity[] = [];
    const entityIds = this.world.entitiesWith("Position", "Renderable");
    for (const entityId of entityIds) {
      const isPlayer = this.world.hasComponent(entityId, "PlayerControlled");
      if (isPlayer) continue;

      const p = this.world.getComponent<Position>(entityId, "Position")!;
      const r = this.world.getComponent<Renderable>(entityId, "Renderable")!;
      const npc = this.world.getComponent<Npc>(entityId, "Npc");
      entities.push({
        x: p.x,
        y: p.y,
        glyph: r.glyph,
        color: r.color,
        npcId: npc?.npcId,
        name: npc?.name,
      });
    }

    const inventory = this.getPlayerInventory();
    const quests = this.getPlayerQuests();
    const zoneId = this.map.zoneId;

    const activeQuestsSnapshot = quests.active.flatMap((questId) => {
      const questDef = getQuestDef(questId);
      if (!questDef) {
        return [];
      }

      const isReady = this.isQuestReadyToComplete(questId);
      const objectives = questDef.objectives.map((obj) => {
        let currentQty = 0;
        let requiredQty = 1;
        if (obj.type === "fetch_item") {
          currentQty = inventory.items
            .filter((item) => item.itemId === obj.itemId)
            .reduce((sum, item) => sum + item.quantity, 0);
          requiredQty = obj.quantity;
        } else if (obj.type === "visit_coordinate") {
          const visited =
            hasCompletedQuestObjective(quests, questId, obj.id) ||
            (obj.zoneId === zoneId && obj.x === pos.x && obj.y === pos.y);
          currentQty = visited ? 1 : 0;
          requiredQty = 1;
        } else if (obj.type === "stat_threshold") {
          currentQty = getStatValue(stats, obj.statName) ?? 0;
          requiredQty = obj.threshold;
        } else if (obj.type === "defeat_npc") {
          const defeated = hasCompletedQuestObjective(quests, questId, obj.id);
          currentQty = defeated ? obj.quantity : 0;
          requiredQty = obj.quantity;
        }
        return {
          id: obj.id,
          description: obj.description,
          type: obj.type,
          npcId: obj.type === "defeat_npc" ? obj.npcId : undefined,
          requiredQuantity: requiredQty,
          currentQuantity: currentQty,
        };
      });
      return [
        {
          questId: questDef.questId,
          name: questDef.name,
          description: questDef.description,
          state: (isReady ? "readyToComplete" : "active") as
            | "active"
            | "readyToComplete",
          objectives,
          targetNpcId: questDef.targetNpcId,
          rewards: questDef.rewards,
        },
      ];
    });

    return {
      tick: this.tickCounter.tick,
      worldTime: createWorldTimeSnapshot(this.worldTimeMinutes),
      zoneId: this.map.zoneId,
      zoneName: this.map.name,
      mapWidth: this.map.width,
      mapHeight: this.map.height,
      playerX: pos.x,
      playerY: pos.y,
      playerFacing: this.playerFacing,
      tiles,
      log: [...this.log],
      stats: cloneStats(stats),
      inventory: {
        ...inventory,
        items: inventory.items.map((stack) => ({ ...stack })),
      },
      npcStates: Object.values(this.npcStates).map(cloneNpcState),
      entities,
      entryDialogue: this.pendingZoneEntryDialogue.map((dialogue) => ({
        ...dialogue,
      })),
      activeQuests: activeQuestsSnapshot,
      completedQuests: [...quests.completed],
      combatState: this.combat.getSnapshot(),
    };
  }

  getPlayerInventory(): Inventory {
    const [playerId] = this.world.entitiesWith("Inventory", "PlayerControlled");
    return this.world.getComponent<Inventory>(playerId, "Inventory")!;
  }

  private getPlayerStats(): Stats {
    const [playerId] = this.world.entitiesWith("Stats", "PlayerControlled");
    return this.world.getComponent<Stats>(playerId, "Stats")!;
  }

  getNpcState(npcId: string): NpcState | undefined {
    const state = this.npcStates[npcId];
    return state ? cloneNpcState(state) : undefined;
  }

  consumeNotices(): EngineNotice[] {
    const notices = this.notices;
    this.notices = [];
    return notices.map((notice) => ({ ...notice }));
  }

  private getPlayerPosition(): Position {
    const [playerId] = this.world.entitiesWith("Position", "PlayerControlled");
    return (
      this.world.getComponent<Position>(playerId, "Position") ??
      ({ type: "Position", x: 0, y: 0 } as Position)
    );
  }

  getPlayerQuests(): Quests {
    const [playerId] = this.world.entitiesWith("Quests", "PlayerControlled");
    return this.world.getComponent<Quests>(playerId, "Quests")!;
  }

  isQuestReadyToComplete(questId: string): boolean {
    const questDef = getQuestDef(questId);
    if (!questDef) return false;

    const inventory = this.getPlayerInventory();
    const quests = this.getPlayerQuests();
    const stats = this.getPlayerStats();
    const position = this.getPlayerPosition();
    const zoneId = this.map.zoneId;

    for (const obj of questDef.objectives) {
      if (obj.type === "fetch_item") {
        const currentQty = inventory.items
          .filter((item) => item.itemId === obj.itemId)
          .reduce((sum, item) => sum + item.quantity, 0);
        if (currentQty < obj.quantity) {
          return false;
        }
      } else if (obj.type === "visit_coordinate") {
        const visited =
          hasCompletedQuestObjective(quests, questId, obj.id) ||
          (obj.zoneId === zoneId && obj.x === position.x && obj.y === position.y);
        if (!visited) {
          return false;
        }
      } else if (obj.type === "stat_threshold") {
        const currentVal = getStatValue(stats, obj.statName) ?? 0;
        if (currentVal < obj.threshold) {
          return false;
        }
      } else if (obj.type === "defeat_npc") {
        if (!hasCompletedQuestObjective(quests, questId, obj.id)) {
          return false;
        }
      }
    }

    return true;
  }

  private resolveNpcDialogue(
    npcId: string,
    baseDialogueId: string,
  ): { dialogueId: string; nodes: DialogueNode[] } {
    const quests = this.getPlayerQuests();
    const overrides: Array<{
      questId: string;
      priority: number;
      dialogueId: string;
    }> = [];

    for (const questDef of getAllQuestDefs()) {
      const override = questDef.npcOverrides[npcId];
      if (!override) continue;

      if (quests.active.includes(questDef.questId)) {
        if (this.isQuestReadyToComplete(questDef.questId)) {
          if (override.activeReady) {
            overrides.push({
              questId: questDef.questId,
              priority: 3,
              dialogueId: override.activeReady,
            });
          }
        } else {
          if (override.active) {
            overrides.push({
              questId: questDef.questId,
              priority: 2,
              dialogueId: override.active,
            });
          }
        }
      } else if (quests.completed.includes(questDef.questId)) {
        if (override.completed) {
          overrides.push({
            questId: questDef.questId,
            priority: 1,
            dialogueId: override.completed,
          });
        }
      }
    }

    if (overrides.length > 0) {
      overrides.sort((a, b) => {
        if (b.priority !== a.priority) {
          return b.priority - a.priority;
        }
        return a.questId.localeCompare(b.questId);
      });
      const chosen = overrides[0].dialogueId;
      return { dialogueId: chosen, nodes: getDialogue(chosen) };
    }

    return { dialogueId: baseDialogueId, nodes: getDialogue(baseDialogueId) };
  }

  private startQuest(questId: string): void {
    const quests = this.getPlayerQuests();
    if (quests.active.includes(questId) || quests.completed.includes(questId)) {
      return;
    }
    quests.active.push(questId);
    const questDef = getQuestDef(questId)!;
    this.addLog(`Started Quest: ${questDef.name}`);
    this.checkCoordinateObjectives();
  }

  private completeQuest(questId: string): EngineEffect[] {
    const quests = this.getPlayerQuests();
    if (!quests.active.includes(questId)) {
      return [];
    }
    if (!this.isQuestReadyToComplete(questId)) {
      return [];
    }

    const questDef = getQuestDef(questId)!;
    const effects: EngineEffect[] = [];

    // 1. Consume items
    const inventory = this.getPlayerInventory();
    const consumedItems = new Map<string, number>();
    for (const obj of questDef.objectives) {
      if (obj.type === "fetch_item") {
        let remaining = obj.quantity;
        for (let i = inventory.items.length - 1; i >= 0 && remaining > 0; i--) {
          const stack = inventory.items[i];
          if (stack.itemId === obj.itemId) {
            const consumed = Math.min(stack.quantity, remaining);
            stack.quantity -= consumed;
            remaining -= consumed;
            consumedItems.set(
              obj.itemId,
              (consumedItems.get(obj.itemId) ?? 0) + consumed,
            );
          }
        }
        inventory.items = inventory.items.filter((stack) => stack.quantity > 0);
      }
    }

    for (const [itemId, quantity] of consumedItems) {
      effects.push({
        type: "ItemLost",
        itemId,
        quantity,
        source: "quest_turn_in",
      });
    }

    const completedObjectiveKeys = new Set(
      questDef.objectives.map((obj) => getQuestObjectiveKey(questId, obj.id)),
    );
    quests.completedObjectives = quests.completedObjectives.filter(
      (objectiveKey) => !completedObjectiveKeys.has(objectiveKey),
    );

    // 2. Award rewards
    const stats = this.getPlayerStats();
    const rewardLogParts: string[] = [];
    if (questDef.rewards.currency) {
      stats.currency += questDef.rewards.currency;
      rewardLogParts.push(formatCurrencyReward(questDef.rewards.currency));
    }
    if (questDef.rewards.items) {
      for (const rewardItem of questDef.rewards.items) {
        const existing = inventory.items.find(
          (item) => item.itemId === rewardItem.itemId,
        );
        if (existing) {
          existing.quantity += rewardItem.quantity;
        } else {
          inventory.items.push({
            itemId: rewardItem.itemId,
            quantity: rewardItem.quantity,
          });
        }

        const itemDef = getItemDef(rewardItem.itemId);
        rewardLogParts.push(
          `${itemDef.name}${rewardItem.quantity > 1 ? ` x${rewardItem.quantity}` : ""}`,
        );
        effects.push({
          type: "ItemCollected",
          itemId: rewardItem.itemId,
          quantity: rewardItem.quantity,
          source: "reward",
        });
      }
    }

    // 3. Mark completed
    quests.active = quests.active.filter((id) => id !== questId);
    quests.completed.push(questId);

    this.addLog(`Completed Quest: ${questDef.name}`);
    if (rewardLogParts.length > 0) {
      this.addLog(`Quest Rewards: ${rewardLogParts.join(", ")}.`);
    }

    return effects;
  }

  private restoreQuestIds(
    activeQuestIds: string[],
    completedQuestIds: string[],
  ): { active: string[]; completed: string[] } {
    const unknownQuestIds = new Set<string>();
    const active = filterKnownQuestIds(activeQuestIds, unknownQuestIds);
    const completed = filterKnownQuestIds(completedQuestIds, unknownQuestIds);

    if (unknownQuestIds.size > 0) {
      const questList = Array.from(unknownQuestIds)
        .sort()
        .map((questId) => questId || "(empty quest id)")
        .join(", ");
      const message =
        `The saved quest data referenced unavailable quest ids and they were cancelled: ${questList}.`;
      this.notices.push({
        title: "Quest Cancelled",
        message,
      });
      this.addLog(message);
    }

    return { active, completed };
  }

  private checkCoordinateObjectives(): void {
    const quests = this.getPlayerQuests();
    const position = this.getPlayerPosition();
    const zoneId = this.map.zoneId;

    for (const questId of quests.active) {
      const questDef = getQuestDef(questId);
      if (!questDef) continue;

      for (const obj of questDef.objectives) {
        if (obj.type === "visit_coordinate") {
          if (
            obj.zoneId === zoneId &&
            obj.x === position.x &&
            obj.y === position.y
          ) {
            const objectiveKey = getQuestObjectiveKey(questId, obj.id);
            if (!quests.completedObjectives.includes(objectiveKey)) {
              quests.completedObjectives.push(objectiveKey);
              this.addLog(`Reached objective area: ${obj.description}`);
            }
          }
        }
      }
    }
  }

  private recordNpcDefeat(npcId: string): void {
    const quests = this.getPlayerQuests();

    for (const questId of quests.active) {
      const questDef = getQuestDef(questId);
      if (!questDef) continue;

      for (const obj of questDef.objectives) {
        if (obj.type !== "defeat_npc" || obj.npcId !== npcId) {
          continue;
        }

        const objectiveKey = getQuestObjectiveKey(questId, obj.id);
        if (!quests.completedObjectives.includes(objectiveKey)) {
          quests.completedObjectives.push(objectiveKey);
          this.addLog(`Completed objective: ${obj.description}`);
        }
      }
    }
  }

  private getTargetPosition(
    pos: Position,
    direction: Direction,
  ): { x: number; y: number } {
    const { dx, dy } = DIRECTION_DELTA[direction];

    return { x: pos.x + dx, y: pos.y + dy };
  }

  private getCurrentZoneNpcSpawns(): NpcSpawnData[] {
    const spawns = this.map.npcs.map(cloneNpcSpawnData);
    const presenceDefs = getAllNpcPresenceDefs();
    this.attachGlobalPresenceSchedules(spawns, presenceDefs);

    const existingNpcIds = new Set(spawns.map((npcData) => npcData.npcId));

    for (const presenceDef of presenceDefs) {
      if (existingNpcIds.has(presenceDef.npcId)) {
        continue;
      }

      const activePosition = NpcScheduleSystem.getActivePosition(
        presenceDef.schedule,
        this.worldTimeMinutes,
      );

      if (!activePosition || activePosition.zoneId !== this.map.zoneId) {
        continue;
      }

      if (!this.map.isWalkable(activePosition.x, activePosition.y)) {
        continue;
      }

      if (
        !this.isNpcSpawnPositionAvailable(
          spawns,
          activePosition.x,
          activePosition.y,
        )
      ) {
        continue;
      }

      spawns.push({
        npcId: presenceDef.npcId,
        dialogueId: activePosition.dialogueId,
        x: activePosition.x,
        y: activePosition.y,
        schedule: presenceDef.schedule.map(cloneNpcScheduleEntry),
      });
      existingNpcIds.add(presenceDef.npcId);
    }

    return spawns;
  }

  private isNpcSpawnPositionAvailable(
    spawns: NpcSpawnData[],
    x: number,
    y: number,
  ): boolean {
    const playerPosition = this.getPlayerPosition();
    if (playerPosition.x === x && playerPosition.y === y) {
      return false;
    }

    return !spawns.some((npcData) => npcData.x === x && npcData.y === y);
  }

  private getScheduledNpcSpawns(): NpcSpawnData[] {
    const spawns = this.map.npcs.map(cloneNpcSpawnData);
    const presenceDefs = getAllNpcPresenceDefs();
    this.attachGlobalPresenceSchedules(spawns, presenceDefs);

    const existingNpcIds = new Set(spawns.map((npcData) => npcData.npcId));

    for (const presenceDef of presenceDefs) {
      if (existingNpcIds.has(presenceDef.npcId)) {
        continue;
      }

      const firstEntry = presenceDef.schedule[0];
      spawns.push({
        npcId: presenceDef.npcId,
        dialogueId: firstEntry.dialogueId,
        x: firstEntry.x,
        y: firstEntry.y,
        schedule: presenceDef.schedule.map(cloneNpcScheduleEntry),
      });
      existingNpcIds.add(presenceDef.npcId);
    }

    return spawns;
  }

  private attachGlobalPresenceSchedules(
    spawns: NpcSpawnData[],
    presenceDefs: ReturnType<typeof getAllNpcPresenceDefs>,
  ): void {
    const presenceByNpcId = new Map(
      presenceDefs.map((presenceDef) => [presenceDef.npcId, presenceDef]),
    );

    for (const spawn of spawns) {
      const presenceDef = presenceByNpcId.get(spawn.npcId);
      if (!presenceDef) {
        continue;
      }
      if (
        !presenceDef.schedule.some((entry) => entry.zoneId === this.map.zoneId)
      ) {
        continue;
      }

      spawn.schedule = presenceDef.schedule.map(cloneNpcScheduleEntry);

      const activePosition = NpcScheduleSystem.getActivePosition(
        spawn.schedule,
        this.worldTimeMinutes,
      );
      if (activePosition?.dialogueId) {
        spawn.dialogueId = activePosition.dialogueId;
      }
    }
  }

  private recoverPlayerFromCombatDefeat(): void {
    const targetMap =
      this.map.zoneId === this.safeRespawn.zoneId
        ? this.map
        : this.resolveZone?.(this.safeRespawn.zoneId);

    if (targetMap && targetMap.zoneId !== this.map.zoneId) {
      this.map = targetMap;
      this.spawnNpcs();
      this.spawnItems();
    }

    const pos = this.getPlayerPosition();
    if (targetMap) {
      pos.x = this.safeRespawn.x;
      pos.y = this.safeRespawn.y;
    } else {
      pos.x = this.map.playerStart.x;
      pos.y = this.map.playerStart.y;
    }

    const playerStats = this.getPlayerStats();
    playerStats.resources.hp = Math.floor(playerStats.resources.maxHp / 2);
    playerStats.resources.energy = Math.floor(playerStats.resources.maxEnergy / 2);
    refreshDerivedStats(playerStats);

    this.addLog("Teleported back to safety. HP and Energy partially restored.");
  }
}

/**
 * Copies an authored NPC spawn before schedule resolution mutates or filters it.
 */
function cloneNpcSpawnData(npcData: NpcSpawnData): NpcSpawnData {
  return {
    ...npcData,
    schedule: npcData.schedule
      ? npcData.schedule.map(cloneNpcScheduleEntry)
      : undefined,
  };
}

/**
 * Copies one schedule entry so registries and maps keep ownership of content
 * data while gameplay systems work with disposable values.
 */
function cloneNpcScheduleEntry(entry: NpcScheduleEntryData): NpcScheduleEntryData {
  return { ...entry };
}

function filterKnownQuestIds(
  questIds: string[],
  unknownQuestIds: Set<string>,
): string[] {
  const knownQuestIds: string[] = [];
  const seenQuestIds = new Set<string>();

  for (const questId of questIds) {
    if (!hasQuestDef(questId)) {
      unknownQuestIds.add(questId);
      continue;
    }

    if (seenQuestIds.has(questId)) {
      continue;
    }

    knownQuestIds.push(questId);
    seenQuestIds.add(questId);
  }

  return knownQuestIds;
}

function normalizeCompletedObjectiveKeys(
  savedObjectiveIds: string[],
  activeQuestIds: string[],
): string[] {
  const candidates = activeQuestIds.flatMap((questId) => {
    const questDef = getQuestDef(questId);
    if (!questDef) return [];

    return questDef.objectives.map((objective) => ({
      objectiveId: objective.id,
      key: getQuestObjectiveKey(questId, objective.id),
    }));
  });
  const knownKeys = new Set(candidates.map((candidate) => candidate.key));
  const normalized = new Set<string>();

  for (const savedObjectiveId of savedObjectiveIds) {
    if (knownKeys.has(savedObjectiveId)) {
      normalized.add(savedObjectiveId);
      continue;
    }

    const legacyMatches = candidates.filter(
      (candidate) => candidate.objectiveId === savedObjectiveId,
    );
    if (legacyMatches.length === 1) {
      normalized.add(legacyMatches[0].key);
    }
  }

  return [...normalized];
}

function hasCompletedQuestObjective(
  quests: Quests,
  questId: string,
  objectiveId: string,
): boolean {
  return quests.completedObjectives.includes(
    getQuestObjectiveKey(questId, objectiveId),
  );
}

function getQuestObjectiveKey(questId: string, objectiveId: string): string {
  return `${questId}:${objectiveId}`;
}

function getZoneEntryEventId(zoneId: string): string {
  return `zone_entry:${zoneId}`;
}

function formatCurrencyReward(copperCoins: number): string {
  const platinum = Math.floor(copperCoins / 1_000_000);
  const gold = Math.floor((copperCoins % 1_000_000) / 10_000);
  const silver = Math.floor((copperCoins % 10_000) / 100);
  const copper = copperCoins % 100;

  const parts: string[] = [];
  if (platinum > 0) parts.push(`${platinum}p`);
  if (gold > 0) parts.push(`${gold}g`);
  if (silver > 0) parts.push(`${silver}s`);
  if (copper > 0 || parts.length === 0) parts.push(`${copper}c`);

  return parts.join(" ");
}
