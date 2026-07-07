import type { GameCommand } from "./commands";
import { EQUIPPED_SLOT_IDS } from "./components";
import type {
  DialogueNode,
  EquippedSlot,
  Inventory,
  Npc,
  Position,
  Renderable,
  Stats,
  Quests,
} from "./components";
import { getClassDef } from "./classes/classRegistry";
import { getTileDef } from "./TileRegistry";
import { getQuestDef, getAllQuestDefs } from "./quests/questRegistry";
import {
  QuestProgressionSystem,
  hasCompletedQuestObjective,
  normalizeCompletedObjectiveKeys,
} from "./quests/QuestProgressionSystem";
import { getDialogue } from "./dialogues/dialogueRegistry";
import { InventorySystem } from "./items/InventorySystem";
import { getItemDef } from "./items/itemRegistry";
import type { EquipmentBonusMap } from "./items/ItemDef";
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
import { getRaceDef } from "./races/raceRegistry";
import {
  applyLayeredStats,
  applyXpAwardToProgression,
  cloneLayeredStatBreakdown,
  clonePlayerProgressionState,
  createInitialPlayerProgression,
  deriveLayeredStats,
  normalizeProgressionBuffers,
  subtractAttributeValues,
  ensureCommandMasteries,
  type CoreAttributeKey,
  type LayeredStatBreakdown,
  type PlayerProgressionState,
  type XpAwardResult,
} from "./stats/layeredStats";
import {
  getCommandMasteryDef,
  hasCommandMasteryDef,
} from "./mastery/commandMasteryRegistry";
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
  /** Technical simulation tick count; UI mostly shows worldTime instead. */
  tick: number;
  /** Narrative calendar time derived from total world minutes. */
  worldTime: WorldTimeSnapshot;
  zoneId: string;
  zoneName: string;
  mapWidth: number;
  mapHeight: number;
  playerX: number;
  playerY: number;
  playerFacing: Direction;
  /** Tile id grid of the active zone, indexed as tiles[y][x]. */
  tiles: number[][];
  log: LogEntry[];
  /** Detached copies: mutating snapshot data never affects the engine. */
  stats: Stats;
  statLayers: LayeredStatBreakdown;
  inventory: Inventory;
  npcStates: NpcState[];
  /** Render-ready NPC and ground item projections for the canvas. */
  entities: RenderEntity[];
  /** Pending one-shot zone entry dialogue; empty once acknowledged. */
  entryDialogue: DialogueNode[];
  /** UI projection of quest progress with live objective quantities. */
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
    rewards: { currency?: number; xp?: number; items?: Array<{ itemId: string; quantity: number }> };
  }>;
  completedQuests: string[];
  /** Present only while a combat encounter is active. */
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
  initialPlayerPosition?: {
    x: number;
    y: number;
  };
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
  playerRaceId?: string;
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
  private readonly quests: QuestProgressionSystem;
  private readonly inventory: InventorySystem;
  private readonly combat: CombatSystem;
  private readonly safeRespawn: SafeRespawnPoint;
  private readonly actionTuning: ActionTuningConfig;
  private basePlayerStats: Stats;
  private playerProgression: PlayerProgressionState;
  private statLayers: LayeredStatBreakdown;

  constructor(map: GameMap, options: GameplayEngineOptions = {}) {
    this.map = map;
    this.resolveZone = options.resolveZone;
    this.actionTuning = options.actions ?? DEFAULT_ACTION_TUNING;
    this.basePlayerStats = createInitialStats(options.newGame);
    this.playerProgression = createInitialPlayerProgression({
      raceId: options.playerRaceId,
    });
    this.statLayers = this.rebuildStatLayers(this.basePlayerStats);
    this.safeRespawn = options.safeRespawn ?? {
      zoneId: map.zoneId,
      x: map.playerStart.x,
      y: map.playerStart.y,
    };
    this.quests = new QuestProgressionSystem({
      getPlayerInventory: () => this.getPlayerInventory(),
      getPlayerQuests: () => this.getPlayerQuests(),
      getPlayerStats: () => this.getPlayerStats(),
      getPlayerPosition: () => this.getPlayerPosition(),
      getZoneId: () => this.map.zoneId,
      addLog: (message) => this.addLog(message),
      addNotice: (notice) => this.notices.push({ ...notice }),
      awardXp: (amount, source) => this.awardPlayerXp(amount, source),
    });
    this.inventory = new InventorySystem({
      world: this.world,
      getPlayerInventory: () => this.getPlayerInventory(),
      getPlayerStats: () => this.getPlayerStats(),
      addLog: (message) => this.addLog(message),
      advanceTick: () => this.tickCounter.advance(),
      advanceWorldTime: (minutes) => this.advanceWorldTime(minutes),
      markItemSpawnPickedUp: (spawnKey) =>
        this.pickedUpItemSpawnKeys.add(spawnKey),
    });
    this.combat = new CombatSystem({
      world: this.world,
      getPlayerStats: () => this.getPlayerStats(),
      getPlayerInventory: () => this.getPlayerInventory(),
      addLog: (message) => this.addLog(message),
      recordNpcDefeat: (npcId) => this.quests.recordNpcDefeat(npcId),
      awardXp: (amount, source) => this.awardPlayerXp(amount, source),
      recoverPlayerFromDefeat: () => this.recoverPlayerFromCombatDefeat(),
      random: options.random,
      getCommandMasteryLevel: (cmd) => this.getCommandMasteryLevel(cmd),
      incrementCommandUsage: (cmd) => this.incrementCommandUsage(cmd),
    });

    const playerId = this.world.createEntity();

    const initialPlayerPosition =
      options.initialPlayerPosition ?? map.playerStart;

    const position = {
      type: "Position" as const,
      x: initialPlayerPosition.x,
      y: initialPlayerPosition.y,
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

    const playerStats = cloneStats(this.basePlayerStats);
    const playerInventory = createStartingInventory(options.newGame);
    this.applyLayeredStatsTo(playerStats, playerInventory);
    this.world.addComponent(playerId, playerStats);
    this.world.addComponent(playerId, playerInventory);

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
      return this.inventory.useItem(command.itemId);
    }

    if (command.type === "Equip") {
      return this.equipItem(command.itemId, command.slot);
    }

    if (command.type === "Unequip") {
      return this.unequipItem(command.slot);
    }

    if (command.type === "ChooseAttribute") {
      return this.chooseAttribute(command.attribute);
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
          this.quests.startQuest(questDef.questId);
        }
        if (questDef.triggers.complete.dialogueId === dialogueId) {
          effects.push(...this.quests.completeQuest(questDef.questId));
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
      this.quests.checkCoordinateObjectives();
      const itemAtPosition = this.inventory.getItemAt(pos.x, pos.y);
      const effects: EngineEffect[] = [];
      if (itemAtPosition) {
        effects.push(
          this.inventory.pickupItem(
            itemAtPosition.entity,
            itemAtPosition.component,
          ),
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
    this.quests.checkCoordinateObjectives();
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
      playerProgression: this.playerProgression,
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
    this.playerProgression = clonePlayerProgressionState(
      saveData.playerProgression,
    );
    const inventory = this.world.getComponent<Inventory>(
      playerId,
      "Inventory",
    )!;
    inventory.items = saveData.inventory.items.map((stack) => ({ ...stack }));
    inventory.equipped = { ...saveData.inventory.equipped };

    this.basePlayerStats = cloneStats(saveData.stats);
    const savedBreakdown = this.rebuildStatLayers(this.basePlayerStats, inventory);
    this.basePlayerStats.attributes = subtractAttributeValues(
      saveData.stats.attributes,
      savedBreakdown.globalAttributes,
      savedBreakdown.classAttributes,
      savedBreakdown.equipmentAttributes,
    );
    this.basePlayerStats.resources.maxEnergy = Math.max(
      0,
      saveData.stats.resources.maxEnergy -
        savedBreakdown.equipmentResources.maxEnergy,
    );
    stats.resources = { ...saveData.stats.resources };
    stats.currency = saveData.stats.currency;
    stats.attributes = { ...this.basePlayerStats.attributes };
    stats.combat = { ...saveData.stats.combat };
    stats.skills = { ...saveData.stats.skills };
    stats.progression = { ...saveData.stats.progression };
    stats.conditions = [...saveData.stats.conditions];
    this.basePlayerStats.skills = { ...stats.skills };
    this.basePlayerStats.progression = { ...stats.progression };
    this.basePlayerStats.conditions = stats.conditions.map((condition) => ({
      ...condition,
    }));
    this.applyLayeredStatsTo(stats, inventory);

    const quests = this.world.getComponent<Quests>(playerId, "Quests")!;
    const restoredQuests = this.quests.restoreQuestIds(
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

  private equipItem(itemId: string, requestedSlot?: EquippedSlot): ExecuteResult {
    const inventory = this.getPlayerInventory();
    const stack = inventory.items.find((item) => item.itemId === itemId);

    if (!stack) {
      const message = "You don't have that item.";
      this.addLog(message);
      this.notices.push({ title: "Cannot Equip", message });
      return { success: false };
    }

    const itemDef = getItemDef(itemId);
    const equipment = itemDef.equipment;
    if (itemDef.category !== "equipment" || !equipment) {
      const message = `${itemDef.name} cannot be equipped.`;
      this.addLog(message);
      this.notices.push({ title: "Cannot Equip", message });
      return { success: false };
    }

    const targetSlot = this.resolveEquippedSlot(
      equipment.slot,
      requestedSlot,
      inventory,
    );
    if (!targetSlot) {
      const message = `${itemDef.name} cannot be assigned to that slot.`;
      this.addLog(message);
      this.notices.push({ title: "Cannot Equip", message });
      return { success: false };
    }

    const classDef = getClassDef(this.playerProgression.classId);
    const permissions = classDef.equipmentPermissions;
    const canEquip =
      equipment.slot === "weapon"
        ? Boolean(
            equipment.weaponType &&
              permissions.allowedWeaponTypes.includes(equipment.weaponType),
          )
        : permissions.allowedArmorSlots.includes(equipment.slot);

    if (!canEquip) {
      const message = `${classDef.name} cannot equip ${itemDef.name}.`;
      this.addLog(message);
      this.notices.push({ title: "Cannot Equip", message });
      return { success: false };
    }

    const equippedCount = this.countEquippedCopies(
      inventory,
      itemId,
      targetSlot,
    );
    if (equippedCount >= stack.quantity) {
      const message = `No unequipped copies of ${itemDef.name} remain.`;
      this.addLog(message);
      this.notices.push({ title: "Cannot Equip", message });
      return { success: false };
    }

    inventory.equipped[targetSlot] = itemId;
    this.applyLayeredStatsTo(this.getPlayerStats(), inventory);
    this.addLog(`Equipped ${itemDef.name}.`);
    return { success: true };
  }

  private unequipItem(slot: EquippedSlot): ExecuteResult {
    const inventory = this.getPlayerInventory();
    const itemId = inventory.equipped[slot];

    if (!itemId) {
      const message = "Nothing is equipped there.";
      this.addLog(message);
      return { success: false };
    }

    delete inventory.equipped[slot];
    this.applyLayeredStatsTo(this.getPlayerStats(), inventory);
    this.addLog(`Unequipped ${getItemDef(itemId).name}.`);
    return { success: true };
  }

  private chooseAttribute(attribute: CoreAttributeKey): ExecuteResult {
    if (!(attribute in this.basePlayerStats.attributes)) {
      return { success: false };
    }

    if (this.playerProgression.pendingAttributeChoices <= 0) {
      const message = "No attribute choices are available.";
      this.addLog(message);
      this.notices.push({ title: "No Attribute Choice", message });
      return { success: false };
    }

    this.playerProgression.pendingAttributeChoices -= 1;
    this.basePlayerStats.attributes[attribute] += 1;
    this.applyLayeredStatsTo(this.getPlayerStats(), this.getPlayerInventory());
    this.addLog(`${formatAttributeName(attribute)} +1.`);
    return { success: true };
  }

  private awardPlayerXp(amount: number, source: string): XpAwardResult {
    const { progression, result } = applyXpAwardToProgression(
      this.playerProgression,
      amount,
    );
    this.playerProgression = progression;

    if (result.amount <= 0) {
      return result;
    }

    this.addLog(`Gained ${result.amount} XP from ${source}.`);
    this.applyLayeredStatsTo(this.getPlayerStats(), this.getPlayerInventory());

    for (const level of result.globalLevelsGained) {
      const message = `Reached global level ${level}.`;
      this.addLog(message);
      this.notices.push({ title: "Global Level Up", message });
    }

    for (const levelUp of result.classLevelsGained) {
      const className = getClassDef(levelUp.classId).name;
      const message = `${className} reached level ${levelUp.level}.`;
      this.addLog(message);
      this.notices.push({ title: "Class Level Up", message });
    }

    if (result.attributeChoicesGained > 0) {
      const message =
        result.attributeChoicesGained === 1
          ? "Choose +1 base attribute from the character sheet."
          : `Choose ${result.attributeChoicesGained} base attributes from the character sheet.`;
      this.notices.push({ title: "Attribute Choice Available", message });
    }

    return result;
  }

  private resolveEquippedSlot(
    equipmentSlot: string,
    requestedSlot: EquippedSlot | undefined,
    inventory: Inventory,
  ): EquippedSlot | undefined {
    if (equipmentSlot === "accessory") {
      if (requestedSlot === "accessory1" || requestedSlot === "accessory2") {
        return requestedSlot;
      }
      if (requestedSlot) return undefined;
      return inventory.equipped.accessory1 ? "accessory2" : "accessory1";
    }

    if (requestedSlot && requestedSlot !== equipmentSlot) {
      return undefined;
    }

    return EQUIPPED_SLOT_IDS.includes(equipmentSlot as EquippedSlot)
      ? (equipmentSlot as EquippedSlot)
      : undefined;
  }

  private countEquippedCopies(
    inventory: Inventory,
    itemId: string,
    exceptSlot?: EquippedSlot,
  ): number {
    return EQUIPPED_SLOT_IDS.reduce((count, slot) => {
      if (slot === exceptSlot) return count;
      return inventory.equipped[slot] === itemId ? count + 1 : count;
    }, 0);
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
    const restMastery = this.getCommandMasteryLevel("rest");
    const baseEnergyRestore = this.actionTuning.rest.energyRestore;
    const energyRestore = baseEnergyRestore + 2 * restMastery;

    const stats = this.getPlayerStats();
    stats.resources.energy = Math.min(
      stats.resources.maxEnergy,
      stats.resources.energy + energyRestore,
    );
    this.tickCounter.advance();
    this.advanceWorldTime(WORLD_TIME_ACTION_COST.rest);

    const restXp = this.actionTuning.rest.xp ?? 2;
    this.awardPlayerXp(restXp, "resting");

    this.addLog(`Rested and recovered ${energyRestore} energy.`);
    this.incrementCommandUsage("rest");
  }

  private studyPlayer(): ExecuteResult {
    const pos = this.getPlayerPosition();
    const tileId = this.map.getTileId(pos.x, pos.y);
    const tileDef = getTileDef(tileId);
    if (!tileDef.studySpot) {
      this.addLog("You can only study in a proper study environment.");
      return { success: false };
    }

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
    this.basePlayerStats.attributes.intelligence =
      (this.basePlayerStats.attributes.intelligence ?? 0) + intelligenceGain;
    stats.skills.scholarship += academicProgressGain;
    this.applyLayeredStatsTo(stats, this.getPlayerInventory());

    this.tickCounter.advance();
    const timeCost = this.actionTuning.study.timeCostMinutes ?? WORLD_TIME_ACTION_COST.study;
    this.advanceWorldTime(timeCost);

    const studyMastery = this.getCommandMasteryLevel("study");
    const baseStudyXp = this.actionTuning.study.xp ?? 10;
    const studyXp = baseStudyXp + 2 * studyMastery;
    this.awardPlayerXp(studyXp, "studying");

    this.addLog(
      `Studied old notes. Intelligence +${intelligenceGain}, scholarship +${academicProgressGain}, academic progress +${academicProgressGain}%.`,
    );
    this.incrementCommandUsage("study");

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
      statLayers: cloneLayeredStatBreakdown(this.statLayers),
      inventory: {
        ...inventory,
        items: inventory.items.map((stack) => ({ ...stack })),
        equipped: { ...inventory.equipped },
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

  private rebuildStatLayers(
    baseStats: Stats,
    inventory?: Inventory,
  ): LayeredStatBreakdown {
    const classDef = getClassDef(this.playerProgression.classId);
    const raceDef = getRaceDef(this.playerProgression.raceId);
    return deriveLayeredStats({
      baseStats,
      progression: this.playerProgression,
      classDef,
      raceDef,
      equipmentBonuses: inventory
        ? this.getEquippedEquipmentBonuses(inventory)
        : {},
    });
  }

  private applyLayeredStatsTo(stats: Stats, inventory?: Inventory): void {
    this.statLayers = this.rebuildStatLayers(this.basePlayerStats, inventory);
    applyLayeredStats(stats, this.statLayers);
    this.playerProgression = normalizeProgressionBuffers(
      this.playerProgression,
      this.statLayers,
    );
  }

  private getEquippedEquipmentBonuses(inventory: Inventory): EquipmentBonusMap {
    const totals: EquipmentBonusMap = {};

    for (const slot of EQUIPPED_SLOT_IDS) {
      const itemId = inventory.equipped[slot];
      if (!itemId) continue;

      const equipment = getItemDef(itemId).equipment;
      if (!equipment) continue;

      for (const [key, value] of Object.entries(equipment.bonuses)) {
        totals[key as keyof EquipmentBonusMap] =
          (totals[key as keyof EquipmentBonusMap] ?? 0) + (value ?? 0);
      }
    }

    return totals;
  }

  getCommandMasteryLevel(commandId: string): number {
    return this.playerProgression.masteries?.[commandId]?.level ?? 0;
  }

  incrementCommandUsage(commandId: string): void {
    this.playerProgression.masteries = ensureCommandMasteries(this.playerProgression.masteries);
    const state = this.playerProgression.masteries[commandId];
    if (!state) return;

    if (!hasCommandMasteryDef(commandId)) return;
    const def = getCommandMasteryDef(commandId);

    if (state.level >= def.cap) return;

    state.usage += 1;
    if (state.usage >= def.usageRequired) {
      state.usage = 0;
      state.level += 1;

      const logMsg = `Your mastery of ${def.name} has increased to level ${state.level}!`;
      this.addLog(logMsg);
      this.notices.push({
        title: "Command Mastery Up",
        message: logMsg,
      });
    }

    this.statLayers = this.rebuildStatLayers(this.basePlayerStats, this.getPlayerInventory());
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
    return this.quests.isQuestReadyToComplete(questId);
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
        if (this.quests.isQuestReadyToComplete(questDef.questId)) {
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

function getZoneEntryEventId(zoneId: string): string {
  return `zone_entry:${zoneId}`;
}

function formatAttributeName(attribute: string): string {
  return attribute
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (firstLetter) => firstLetter.toUpperCase());
}
