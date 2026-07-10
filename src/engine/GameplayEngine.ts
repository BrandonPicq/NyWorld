import type { GameCommand } from "./commands";
import { buildGameSnapshot } from "./gameplay/GameSnapshotBuilder";
import type {
  EngineEffect,
  EngineNotice,
  ExecuteResult,
  GameSnapshot,
} from "./gameplay/GameplayTypes";
import type {
  Inventory,
  Npc,
  Position,
  Stats,
  Quests,
} from "./components";
import { getTileDef } from "./TileRegistry";
import { getAllQuestDefs } from "./quests/questRegistry";
import {
  QuestProgressionSystem,
  normalizeCompletedObjectiveKeys,
} from "./quests/QuestProgressionSystem";
import { DialogueRuntime } from "./dialogues/DialogueRuntime";
import { getNpcDef, hasNpcDef } from "./npcs/npcRegistry";
import { NpcWorldRuntime } from "./npcs/NpcWorldRuntime";
import { InventorySystem } from "./items/InventorySystem";
import { getItemDef } from "./items/itemRegistry";
import type { NpcState } from "./npcs/NpcState";
import { spawnItemsInWorld } from "./spawner/EntitySpawner";
import { serializeSaveData } from "./save/gameSaveSerializer";
import { World } from "./ecs/World";
import { GameMap } from "./GameMap";
import { GameLog } from "./logs/GameLog";
import { DIRECTION_DELTA, MovementSystem } from "./systems/MovementSystem";
import type { Direction } from "./systems/MovementSystem";
import { NpcScheduleSystem } from "./systems/NpcScheduleSystem";
import { TickCounter } from "./tick";
import type { ZoneTransitionData } from "./ZoneTypes";
import type { GameSaveData } from "./GameSaveData";
import type {
  ActionTuningConfig,
  NewGameConfig,
  SafeRespawnPoint,
} from "./content/contentBundle";
import { createStartingInventory } from "./newGameState";
import { RespawnState } from "./spawn/RespawnState";
import { ExplorationState } from "./exploration/ExplorationState";
import {
  START_WORLD_TIME_MINUTES,
  WORLD_TIME_ACTION_COST,
} from "./time/WorldCalendar";
import { refreshDerivedStats } from "./stats/characterStats";
import { PlayerCharacterRuntime } from "./stats/PlayerCharacterRuntime";
import { CombatSystem, isCombatNpc } from "./combat/CombatSystem";
import {
  cloneKnownPatterns,
  QtePatternLearningSystem,
} from "./combat/QtePatternLearningSystem";
import type { KnownPatternMap } from "./combat/PatternDef";
import { EventSystem, type EventSystemResult } from "./events/EventSystem";
import type { EventDef } from "./events/EventDef";
import { hasEnemyDef } from "./enemies/enemyRegistry";

export type { CombatState } from "./combat/CombatSystem";
export type {
  EngineEffect,
  EngineNotice,
  ExecuteResult,
  GameSnapshot,
  RenderEntity,
} from "./gameplay/GameplayTypes";

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
  events?: readonly EventDef[];
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

  private readonly log = new GameLog(() => ({
    tick: this.tickCounter.tick,
    worldTimeMinutes: this.worldTimeMinutes,
  }));
  private playerFacing: Direction = "south";
  private pickedUpItemSpawnKeys = new Set<string>();
  private resolveZone?: ZoneResolver;
  private worldTimeMinutes = START_WORLD_TIME_MINUTES;
  private readonly npcs: NpcWorldRuntime;
  private readonly dialogues = new DialogueRuntime();
  private notices: EngineNotice[] = [];
  private readonly quests: QuestProgressionSystem;
  private readonly inventory: InventorySystem;
  private readonly patternLearning: QtePatternLearningSystem;
  private readonly combat: CombatSystem;
  private readonly respawn: RespawnState;
  private readonly exploration = new ExplorationState();
  private readonly actionTuning: ActionTuningConfig;
  private readonly character: PlayerCharacterRuntime;
  private knownPatterns: KnownPatternMap = {};
  private readonly eventSystem: EventSystem;

  constructor(map: GameMap, options: GameplayEngineOptions = {}) {
    this.map = map;
    this.resolveZone = options.resolveZone;
    this.actionTuning = options.actions ?? DEFAULT_ACTION_TUNING;
    this.respawn = new RespawnState(options.safeRespawn ?? {
      zoneId: map.zoneId,
      x: map.playerStart.x,
      y: map.playerStart.y,
    });
    this.character = new PlayerCharacterRuntime({
      newGame: options.newGame,
      raceId: options.playerRaceId,
      addLog: (message) => this.log.add(message),
      addNotice: (notice) => this.notices.push({ ...notice }),
    });
    this.quests = new QuestProgressionSystem({
      getPlayerInventory: () => this.getPlayerInventory(),
      getPlayerQuests: () => this.getPlayerQuests(),
      getPlayerStats: () => this.getPlayerStats(),
      getPlayerPosition: () => this.getPlayerPosition(),
      getZoneId: () => this.map.zoneId,
      addLog: (message) => this.log.add(message),
      addNotice: (notice) => this.notices.push({ ...notice }),
      awardXp: (amount, source) =>
        this.character.awardXp(
          amount,
          source,
          this.getPlayerStats(),
          this.getPlayerInventory(),
        ),
    });
    this.inventory = new InventorySystem({
      world: this.world,
      getPlayerInventory: () => this.getPlayerInventory(),
      getPlayerStats: () => this.getPlayerStats(),
      addLog: (message) => this.log.add(message),
      advanceTick: () => this.tickCounter.advance(),
      advanceWorldTime: (minutes) => this.advanceWorldTime(minutes),
      markItemSpawnPickedUp: (spawnKey) =>
        this.pickedUpItemSpawnKeys.add(spawnKey),
    });
    this.patternLearning = new QtePatternLearningSystem({
      getPlayerInventory: () => this.getPlayerInventory(),
      getPlayerStats: () => this.getPlayerStats(),
      getGlobalLevel: () => this.character.getGlobalLevel(),
      getKnownPatterns: () => this.knownPatterns,
      addLog: (message) => this.log.add(message),
      addNotice: (notice) => this.notices.push({ ...notice }),
      advanceTick: () => this.tickCounter.advance(),
      advanceWorldTime: (minutes) => this.advanceWorldTime(minutes),
    });
    this.combat = new CombatSystem({
      world: this.world,
      getPlayerStats: () => this.getPlayerStats(),
      getPlayerInventory: () => this.getPlayerInventory(),
      addLog: (message) => this.log.add(message),
      recordNpcDefeat: (npcId) => this.quests.recordNpcDefeat(npcId),
      awardXp: (amount, source) =>
        this.character.awardXp(
          amount,
          source,
          this.getPlayerStats(),
          this.getPlayerInventory(),
        ),
      recoverPlayerFromDefeat: () => this.recoverPlayerFromCombatDefeat(),
      random: options.random,
      getCommandMasteryLevel: (cmd) => this.character.getCommandMasteryLevel(cmd),
      incrementCommandUsage: (cmd) =>
        this.character.incrementCommandUsage(cmd, this.getPlayerInventory()),
      getKnownPatterns: () => this.knownPatterns,
      incrementPatternUsage: (patternId) => this.incrementPatternUsage(patternId),
    });
    this.npcs = new NpcWorldRuntime({
      world: this.world,
      getPlayerPosition: () => this.getPlayerPosition(),
      getPlayerQuests: () => this.getPlayerQuests(),
      isQuestReadyToComplete: (questId) => this.quests.isQuestReadyToComplete(questId),
    });

    this.eventSystem = new EventSystem(options.events ?? [], {
      getZoneId: () => this.map.zoneId,
      getPlayerPosition: () => this.getPlayerPosition(),
      getPlayerInventory: () => this.getPlayerInventory(),
      getPlayerStats: () => this.getPlayerStats(),
      getGlobalLevel: () => this.character.getGlobalLevel(),
      getWorldTimeMinutes: () => this.worldTimeMinutes,
      getTick: () => this.tickCounter.tick,
      getQuestState: (questId) => this.getEventQuestState(questId),
      getQuestIds: () => {
        const quests = this.getPlayerQuests();
        return { active: quests.active, completed: quests.completed };
      },
      awardXp: (amount, source) =>
        this.character.awardXp(
          amount,
          source,
          this.getPlayerStats(),
          this.getPlayerInventory(),
        ),
      addCurrency: (amount) => {
        const stats = this.getPlayerStats();
        stats.currency = Math.max(0, stats.currency + amount);
      },
      giveItem: (itemId, quantity) => this.giveEventItem(itemId, quantity),
      removeItem: (itemId, quantity) => this.removeEventItem(itemId, quantity),
      setFlagNotice: (flag, value) => this.log.add(`${value ? "Set" : "Cleared"} world flag ${flag}.`),
      addLog: (message) => this.log.add(message),
      addNotice: (message) => this.notices.push({ title: "World Event", message }),
      startDialogue: () => undefined,
      startQuest: (questId) => this.startQuestWithEvents(questId),
      advanceQuest: (questId) => {
        if (this.getPlayerQuests().active.includes(questId)) {
          this.completeQuestWithEvents(questId);
        } else {
          this.startQuestWithEvents(questId);
        }
      },
      spawnEnemy: (enemyId, x, y) => this.spawnEventNpc(enemyId, x, y, undefined, true),
      despawnEnemy: (enemyId) => this.despawnEventNpc(enemyId, true),
      spawnNpc: (npcId, x, y, dialogueId) => this.spawnEventNpc(npcId, x, y, dialogueId, false),
      despawnNpc: (npcId) => this.despawnEventNpc(npcId, false),
      startCombat: (enemyId) => this.startEventCombat(enemyId),
      teleport: (zoneId, x, y) => this.teleportEventPlayer(zoneId, x, y),
      setRespawn: (zoneId, x, y) => this.setEventRespawn(zoneId, x, y),
      revealArea: (zoneId, x, y, width, height) =>
        this.revealEventArea(zoneId, x, y, width, height),
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

    const playerStats = this.character.createPlayerStats();
    const playerInventory = createStartingInventory(options.newGame);
    this.character.initialize(playerStats, playerInventory);
    this.world.addComponent(playerId, playerStats);
    this.world.addComponent(playerId, playerInventory);

    this.discoverCurrentArea();

    const quests: Quests = {
      type: "Quests",
      active: [],
      completed: [],
      completedObjectives: [],
    };
    this.world.addComponent(playerId, quests);

    this.spawnNpcs();
    this.spawnItems();

    this.log.add(`Entered ${map.name}.`);
    this.dialogues.queueZoneEntry(map);
    this.applyEventResult(this.eventSystem.onEnterZone());
  }

  private spawnNpcs(): void {
    this.npcs.spawnForMap(this.map, this.worldTimeMinutes);
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
   * blocked by map geometry or an NPC dialogue collision. Successful movement
   * stays silent in the action log; repeated geometry-blocked messages are
   * collapsed until another log entry is produced. Interact checks nearby or
   * direction-limited tiles for contextual actions without moving.
   */
  execute(command: GameCommand): ExecuteResult {
    if (this.dialogues.isEventDialogueBlocking && command.type !== "CompleteDialogue") {
      return { success: false };
    }

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
      const eventWillFire = this.eventSystem.willFireOnInteract();
      return this.mergeEventResult(
        this.interact(command.targetNpcId, command.targetDirection, eventWillFire),
        this.eventSystem.onInteract(),
      );
    }

    if (command.type === "UseItem") {
      if (this.patternLearning.canHandleItem(command.itemId)) {
        return this.patternLearning.usePatternTome(command.itemId);
      }
      return this.inventory.useItem(command.itemId);
    }

    if (command.type === "Equip") {
      return this.character.equip(
        command.itemId,
        command.slot,
        this.getPlayerStats(),
        this.getPlayerInventory(),
      );
    }

    if (command.type === "Unequip") {
      return this.character.unequip(
        command.slot,
        this.getPlayerStats(),
        this.getPlayerInventory(),
      );
    }

    if (command.type === "ChooseAttribute") {
      return this.character.chooseAttribute(
        command.attribute,
        this.getPlayerStats(),
        this.getPlayerInventory(),
      );
    }

    if (command.type === "CompleteDialogue") {
      const completedEventDialogue = this.dialogues.completeEventDialogue();
      if (completedEventDialogue.wasBlocking) {
        const resumed = this.mergeEventResult(
          { success: true },
          this.eventSystem.resumeAfterDialogue(),
        );
        return completedEventDialogue.dialogueId
          ? this.mergeEventResult(
              resumed,
              this.eventSystem.onDialogueEnd(completedEventDialogue.dialogueId),
            )
          : resumed;
      }
      const dialogueId = this.dialogues.consumeNpcDialogueCompletion();

      if (!dialogueId) {
        return { success: false };
      }

      const effects: EngineEffect[] = [];
      for (const questDef of getAllQuestDefs()) {
        if (questDef.triggers.start.dialogueId === dialogueId) {
          this.startQuestWithEvents(questDef.questId);
        }
        if (questDef.triggers.complete.dialogueId === dialogueId) {
          effects.push(...this.completeQuestWithEvents(questDef.questId));
        }
      }
      const result = effects.length > 0
        ? { success: true, effects }
        : { success: true };
      return this.mergeEventResult(result, this.eventSystem.onDialogueEnd(dialogueId));
    }

    if (command.type === "AcknowledgeZoneEntryDialogue") {
      return { success: this.dialogues.acknowledgeZoneEntry() };
    }

    const direction = COMMAND_DIRECTION[command.type];

    if (!direction) {
      return { success: false };
    }

    this.playerFacing = direction;

    const stats = this.getPlayerStats();
    if (stats.resources.energy <= 0) {
      this.log.add(
        "You are too exhausted to move! Rest [R] to recover energy.",
      );
      return { success: false };
    }

    const positionBefore = this.getPlayerPosition();
    const target = this.getTargetPosition(positionBefore, direction);

    const blockingNpc = this.npcs.getNpcAt(target.x, target.y);
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
      this.discoverCurrentArea();
      return this.mergeEventResult(
        effects.length > 0 ? { success: true, effects } : { success: true },
        this.eventSystem.onStep(),
      );
    }

    this.log.addUnlessRepeated(
      `Cannot move ${direction} — blocked at (${target.x}, ${target.y}).`,
    );

    return { success: false };
  }

  private interact(
    targetNpcId?: string,
    targetDirection?: Direction,
    eventWillFire = false,
  ): ExecuteResult {
    const playerPosition = this.getPlayerPosition();
    const adjacentNpcs: Npc[] = [];
    const directionsToCheck = targetDirection
      ? [targetDirection]
      : INTERACTION_DIRECTIONS;

    for (const direction of directionsToCheck) {
      const target = this.getTargetPosition(playerPosition, direction);
      const npc = this.npcs.getNpcAt(target.x, target.y);

      if (npc) {
        adjacentNpcs.push(npc);
      }
    }

    if (adjacentNpcs.length === 0) {
      if (eventWillFire) {
        return { success: true };
      }
      this.log.add(
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

      this.log.add("That interaction target is no longer nearby.");
      return { success: false };
    }

    const firstNpc = adjacentNpcs[0];
    if (isCombatNpc(firstNpc.npcId)) {
      return this.combat.startCombat(firstNpc);
    }
    return this.talkToNpc(firstNpc, true);
  }

  private talkToNpc(
    npc: Npc,
    success: boolean,
  ): ExecuteResult {
    const resolved = this.npcs.resolveDialogue(npc.npcId, npc.dialogueId);
    this.dialogues.setNpcDialogueCompletion(resolved.dialogueId);

    this.advanceWorldTime(WORLD_TIME_ACTION_COST.dialogue);
    this.log.add(`Talked to ${npc.name}.`);

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
  enterZone(map: GameMap, entryX: number, entryY: number): EventSystemResult {
    this.map = map;
    this.spawnNpcs();
    this.spawnItems();

    const pos = this.getPlayerPosition();
    pos.x = entryX;
    pos.y = entryY;

    this.log.add(`Entered ${map.name}.`);
    this.dialogues.queueZoneEntry(map);
    this.quests.checkCoordinateObjectives();
    this.discoverCurrentArea();
    return this.eventSystem.onEnterZone();
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
      playerProgression: this.character.getProgression(),
      knownPatterns: this.knownPatterns,
      inventory: this.getPlayerInventory(),
      npcStates: this.npcs.getStates(),
      log: this.log.getEntries(),
      pickedUpItemSpawnKeys: this.pickedUpItemSpawnKeys,
      seenZoneEntryEventIds: this.dialogues.getSeenZoneEntryEventIds(),
      ...this.eventSystem.getState(),
      currentSafeRespawn: this.respawn.get(),
      ...this.exploration.getState(),
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
    this.knownPatterns = cloneKnownPatterns(saveData.knownPatterns);
    const inventory = this.world.getComponent<Inventory>(
      playerId,
      "Inventory",
    )!;
    inventory.items = saveData.inventory.items.map((stack) => ({ ...stack }));
    inventory.equipped = { ...saveData.inventory.equipped };

    this.character.restore(
      saveData.stats,
      saveData.playerProgression,
      stats,
      inventory,
    );

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
    this.npcs.restoreStates(saveData.npcStates);
    this.playerFacing = saveData.playerFacing;
    this.log.restore(saveData.log);
    this.pickedUpItemSpawnKeys = new Set(saveData.pickedUpItemSpawnKeys);
    this.dialogues.restoreSeenZoneEntryEventIds(saveData.seenZoneEntryEventIds);
    this.eventSystem.restoreState({
      worldFlags: saveData.worldFlags,
      firedEventIds: saveData.firedEventIds,
      eventCooldowns: saveData.eventCooldowns,
      zoneVisitEventIds: saveData.zoneVisitEventIds,
      legacySeenZoneEntryEventIds: saveData.seenZoneEntryEventIds,
    });
    if (saveData.currentSafeRespawn) {
      this.respawn.set(saveData.currentSafeRespawn);
    }
    this.exploration.restore({
      exploredCellsByZone: saveData.exploredCellsByZone,
    });
    this.dialogues.resetTransientState();

    const pos = this.getPlayerPosition();
    pos.x = saveData.playerX;
    pos.y = saveData.playerY;
    this.discoverCurrentArea();

    this.spawnNpcs();
    this.spawnItems();
    this.dialogues.markZoneEntrySeen(this.map.zoneId);
  }

  private resolvePendingTransition(): void {
    const transition = this.getPendingTransition();

    if (!transition || !this.resolveZone) {
      return;
    }

    const nextMap = this.resolveZone(transition.targetZoneId);

    if (!nextMap) {
      this.log.add(`Cannot enter missing zone ${transition.targetZoneId}.`);
      return;
    }

    this.applyEventResult(
      this.enterZone(nextMap, transition.targetX, transition.targetY),
    );
  }

  private mergeEventResult(
    base: ExecuteResult,
    eventResult: EventSystemResult,
  ): ExecuteResult {
    this.applyEventResult(eventResult);
    const merged: ExecuteResult = {
      success: base.success || eventResult.success === true,
      dialogue: base.dialogue ?? eventResult.dialogue,
      dialogueId: base.dialogueId ?? eventResult.dialogueId,
    };
    const effects = [...(base.effects ?? []), ...(eventResult.effects ?? [])] as EngineEffect[];
    if (effects.length > 0) merged.effects = effects;
    return merged;
  }

  private applyEventResult(result: EventSystemResult): void {
    this.dialogues.applyEventResult(result);
  }

  private getEventQuestState(
    questId: string,
  ): "not_started" | "active" | "readyToComplete" | "completed" {
    const quests = this.getPlayerQuests();
    if (quests.completed.includes(questId)) return "completed";
    if (quests.active.includes(questId)) {
      return this.isQuestReadyToComplete(questId) ? "readyToComplete" : "active";
    }
    return "not_started";
  }

  private startQuestWithEvents(questId: string): void {
    const previous = this.getEventQuestState(questId);
    this.quests.startQuest(questId);
    const next = this.getEventQuestState(questId);
    if (previous !== next) {
      this.applyEventResult(this.eventSystem.onQuestStateChange(questId, next));
    }
  }

  private completeQuestWithEvents(questId: string): EngineEffect[] {
    const previous = this.getEventQuestState(questId);
    const effects = this.quests.completeQuest(questId) as EngineEffect[];
    const next = this.getEventQuestState(questId);
    if (previous !== next) {
      this.applyEventResult(this.eventSystem.onQuestStateChange(questId, next));
    }
    return effects;
  }

  private giveEventItem(
    itemId: string,
    quantity: number,
  ): EventSystemResult["effects"] {
    const inventory = this.getPlayerInventory();
    const stack = inventory.items.find((item) => item.itemId === itemId);
    if (stack) stack.quantity += quantity;
    else inventory.items.push({ itemId, quantity });
    this.log.add(`Received ${getItemDef(itemId).name}${quantity > 1 ? ` x${quantity}` : ""}.`);
    return [{ type: "ItemCollected", itemId, quantity, source: "event" }];
  }

  private removeEventItem(
    itemId: string,
    quantity: number,
  ): EventSystemResult["effects"] {
    let remaining = quantity;
    const inventory = this.getPlayerInventory();
    for (let index = inventory.items.length - 1; index >= 0 && remaining > 0; index -= 1) {
      const stack = inventory.items[index];
      if (stack.itemId !== itemId) continue;
      const removed = Math.min(stack.quantity, remaining);
      stack.quantity -= removed;
      remaining -= removed;
    }
    inventory.items = inventory.items.filter((item) => item.quantity > 0);
    const removed = quantity - remaining;
    if (removed <= 0) return [];
    this.log.add(`Lost ${getItemDef(itemId).name}${removed > 1 ? ` x${removed}` : ""}.`);
    return [{ type: "ItemLost", itemId, quantity: removed, source: "event" }];
  }

  private spawnEventNpc(
    npcId: string,
    x: number,
    y: number,
    dialogueId: string | undefined,
    enemy: boolean,
  ): boolean {
    if (enemy && !hasEnemyDef(npcId)) return false;
    if (!this.map.isInBounds(x, y) || !this.map.isWalkable(x, y)) return false;
    return this.npcs.spawnNpc(npcId, x, y, dialogueId);
  }

  private despawnEventNpc(npcId: string, enemy: boolean): boolean {
    if (enemy && !hasEnemyDef(npcId)) return false;
    if (this.combat.getActiveOpponentNpcId() === npcId) return false;
    return this.npcs.despawnNpc(npcId);
  }

  private startEventCombat(enemyId: string): EventSystemResult {
    if (!hasEnemyDef(enemyId) || !hasNpcDef(enemyId)) return { success: false };
    const npc = this.npcs.getNpcById(enemyId);
    if (npc) {
      return { success: this.combat.startCombat(npc).success };
    }
    // No map presence required: event combats can summon the enemy directly.
    return {
      success: this.combat.startCombatWithoutEntity(
        enemyId,
        getNpcDef(enemyId).name,
      ).success,
    };
  }

  private teleportEventPlayer(zoneId: string, x: number, y: number): boolean {
    if (!this.resolveZone) return false;
    const nextMap = this.resolveZone(zoneId);
    if (!nextMap || !nextMap.isInBounds(x, y) || !nextMap.isWalkable(x, y)) {
      this.log.add(`Cannot teleport to blocked position (${x}, ${y}) in ${zoneId}.`);
      this.notices.push({ title: "Teleport Rejected", message: "That destination is not walkable." });
      return false;
    }
    this.applyEventResult(this.enterZone(nextMap, x, y));
    return true;
  }

  /** Validates and records an event-authored recovery destination for this save. */
  private setEventRespawn(zoneId: string, x: number, y: number): boolean {
    const targetMap = this.map.zoneId === zoneId ? this.map : this.resolveZone?.(zoneId);
    if (!targetMap || !targetMap.isWalkable(x, y)) {
      return false;
    }
    this.respawn.set({ zoneId, x, y });
    this.log.add(`Safe respawn set to ${targetMap.name} (${x}, ${y}).`);
    return true;
  }

  /** Applies a permanent event revelation after resolving the target zone. */
  private revealEventArea(
    zoneId: string,
    x: number,
    y: number,
    width: number,
    height: number,
  ): boolean {
    const targetMap = this.map.zoneId === zoneId ? this.map : this.resolveZone?.(zoneId);
    return targetMap
      ? this.exploration.revealArea(targetMap, x, y, width, height)
      : false;
  }

  private discoverCurrentArea(): void {
    this.exploration.discoverAround(this.map, this.getPlayerPosition());
  }

  private restPlayer(): void {
    const restMastery = this.character.getCommandMasteryLevel("rest");
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
    this.character.awardXp(restXp, "resting", stats, this.getPlayerInventory());

    this.log.add(`Rested and recovered ${energyRestore} energy.`);
    this.character.incrementCommandUsage("rest", this.getPlayerInventory());
  }

  private studyPlayer(): ExecuteResult {
    const pos = this.getPlayerPosition();
    const tileId = this.map.getTileId(pos.x, pos.y);
    const tileDef = getTileDef(tileId);
    if (!tileDef.studySpot) {
      this.log.add("You can only study in a proper study environment.");
      return { success: false };
    }

    const { energyCost, academicProgressGain, intelligenceGain } =
      this.actionTuning.study;
    const stats = this.getPlayerStats();

    if (stats.resources.energy < energyCost) {
      this.log.add("You are too exhausted to study. Rest [R] to recover energy.");
      return { success: false };
    }

    stats.resources.energy = Math.max(0, stats.resources.energy - energyCost);
    stats.progression.academicProgress = Math.min(
      100,
      stats.progression.academicProgress + academicProgressGain,
    );
    this.character.increaseBaseAttribute("intelligence", intelligenceGain);
    stats.skills.scholarship += academicProgressGain;
    this.character.applyTo(stats, this.getPlayerInventory());

    this.tickCounter.advance();
    const timeCost = this.actionTuning.study.timeCostMinutes ?? WORLD_TIME_ACTION_COST.study;
    this.advanceWorldTime(timeCost);

    const studyMastery = this.character.getCommandMasteryLevel("study");
    const baseStudyXp = this.actionTuning.study.xp ?? 10;
    const studyXp = baseStudyXp + 2 * studyMastery;
    this.character.awardXp(studyXp, "studying", stats, this.getPlayerInventory());

    this.log.add(
      `Studied old notes. Intelligence +${intelligenceGain}, scholarship +${academicProgressGain}, academic progress +${academicProgressGain}%.`,
    );
    this.character.incrementCommandUsage("study", this.getPlayerInventory());

    return { success: true };
  }

  private advanceWorldTime(minutes: number): void {
    const previousMinutes = this.worldTimeMinutes;
    this.worldTimeMinutes += minutes;
    NpcScheduleSystem.apply(
      this.world,
      this.map,
      this.npcs.getScheduledSpawns(this.map, this.worldTimeMinutes),
      this.worldTimeMinutes,
    );
    this.applyEventResult(
      this.eventSystem.onTimeAdvanced(previousMinutes, this.worldTimeMinutes),
    );
  }

  /**
   * Builds an immutable snapshot for React and render adapters.
   */
  getSnapshot(): GameSnapshot {
    const pos = this.getPlayerPosition();
    const stats = this.getPlayerStats();
    const inventory = this.getPlayerInventory();
    const quests = this.getPlayerQuests();
    const dialogueSnapshot = this.dialogues.getSnapshot();
    const eventState = this.eventSystem.getState();

    return buildGameSnapshot({
      world: this.world,
      map: this.map,
      tick: this.tickCounter.tick,
      worldTimeMinutes: this.worldTimeMinutes,
      playerPosition: pos,
      playerFacing: this.playerFacing,
      mapVisibility: this.exploration.getVisibility(this.map, pos),
      log: this.log.getEntries(),
      stats,
      statLayers: this.character.getStatLayers(),
      knownPatterns: this.knownPatterns,
      inventory,
      npcStates: this.npcs.getStates(),
      entryDialogue: dialogueSnapshot.entryDialogue,
      eventDialogue: dialogueSnapshot.eventDialogue,
      eventDialogueId: dialogueSnapshot.eventDialogueId,
      worldFlags: eventState.worldFlags,
      firedEventIds: eventState.firedEventIds,
      quests,
      combatState: this.combat.getSnapshot(),
      isQuestReadyToComplete: (questId) => this.isQuestReadyToComplete(questId),
    });
  }

  getPlayerInventory(): Inventory {
    const [playerId] = this.world.entitiesWith("Inventory", "PlayerControlled");
    return this.world.getComponent<Inventory>(playerId, "Inventory")!;
  }

  private getPlayerStats(): Stats {
    const [playerId] = this.world.entitiesWith("Stats", "PlayerControlled");
    return this.world.getComponent<Stats>(playerId, "Stats")!;
  }

  incrementPatternUsage(patternId: string): void {
    const state = this.knownPatterns[patternId];
    if (!state) return;
    state.timesUsed += 1;
    this.patternLearning.learnEligibleEvolutions(patternId);
  }

  getNpcState(npcId: string): NpcState | undefined {
    return this.npcs.getState(npcId);
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

  private getTargetPosition(
    pos: Position,
    direction: Direction,
  ): { x: number; y: number } {
    const { dx, dy } = DIRECTION_DELTA[direction];

    return { x: pos.x + dx, y: pos.y + dy };
  }

  private recoverPlayerFromCombatDefeat(): void {
    const safeRespawn = this.respawn.get();
    const targetMap =
      this.map.zoneId === safeRespawn.zoneId
        ? this.map
        : this.resolveZone?.(safeRespawn.zoneId);

    if (targetMap && targetMap.zoneId !== this.map.zoneId) {
      this.map = targetMap;
      this.spawnNpcs();
      this.spawnItems();
    }

    const pos = this.getPlayerPosition();
    if (targetMap) {
      pos.x = safeRespawn.x;
      pos.y = safeRespawn.y;
    } else {
      pos.x = this.map.playerStart.x;
      pos.y = this.map.playerStart.y;
    }

    const playerStats = this.getPlayerStats();
    playerStats.resources.hp = Math.floor(playerStats.resources.maxHp / 2);
    playerStats.resources.energy = Math.floor(playerStats.resources.maxEnergy / 2);
    refreshDerivedStats(playerStats);

    this.log.add("Teleported back to safety. HP and Energy partially restored.");
  }
}
