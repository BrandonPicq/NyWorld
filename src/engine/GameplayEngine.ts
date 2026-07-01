import type { GameCommand } from "./commands";
import type {
  DialogueNode,
  Inventory,
  Item,
  Npc,
  Position,
  Renderable,
  Stats,
} from "./components";
import { getItemDef } from "./items/itemRegistry";
import { getItemMapPresentation } from "./items/itemMapPresentation";
import { getNpcMapPresentation } from "./npcs/npcMapPresentation";
import { getAllNpcDefs, getNpcDef } from "./npcs/npcRegistry";
import {
  cloneNpcState,
  createInitialNpcState,
  type NpcState,
  type NpcStateMap,
} from "./npcs/NpcState";
import { World } from "./ecs/World";
import type { EntityId } from "./ecs/types";
import { GameMap } from "./GameMap";
import { DIRECTION_DELTA, MovementSystem } from "./systems/MovementSystem";
import type { Direction } from "./systems/MovementSystem";
import { TickCounter } from "./tick";
import type { ZoneTransitionData } from "./ZoneTypes";
import type { GameSaveData } from "./GameSaveData";
import { SAVE_VERSION } from "./GameSaveData";
import {
  START_WORLD_TIME_MINUTES,
  WORLD_TIME_ACTION_COST,
  createWorldTimeSnapshot,
  type WorldTimeSnapshot,
} from "./time/WorldCalendar";

export interface LogEntry {
  tick: number;
  worldTimeMinutes: number;
  message: string;
}

export type EngineEffect =
  | { type: "ItemCollected"; itemId: string; quantity: number }
  | { type: "ItemUsed"; itemId: string; energyRestored: number }
  | {
      type: "ItemUseRejected";
      itemId: string;
      reason: "energy_full" | "no_effect";
      message: string;
    };

export interface ExecuteResult {
  success: boolean;
  dialogue?: DialogueNode[];
  effects?: EngineEffect[];
}

export interface RenderEntity {
  x: number;
  y: number;
  glyph: string;
  color: string;
  npcId?: string;
  name?: string;
}

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
}

const COMMAND_DIRECTION: Record<string, Direction> = {
  MoveNorth: "north",
  MoveSouth: "south",
  MoveWest: "west",
  MoveEast: "east",
};

const INTERACTION_DIRECTIONS: Direction[] = ["north", "east", "south", "west"];

const CONSUMABLE_ENERGY: Record<string, number> = {
  travel_ration: 10,
  healing_herb: 20,
};

type ZoneResolver = (zoneId: string) => GameMap | undefined;

type GameplayEngineOptions = {
  resolveZone?: ZoneResolver;
};

/**
 * Owns the mutable game simulation state.
 *
 * React should interact with this class only through explicit commands and
 * snapshots so gameplay rules stay independent from rendering and UI state.
 */
export class GameplayEngine {
  readonly world = new World();
  readonly tickCounter = new TickCounter();
  map: GameMap;

  private log: LogEntry[] = [];
  private playerFacing: Direction = "south";
  private pickedUpItemSpawnKeys = new Set<string>();
  private resolveZone?: ZoneResolver;
  private worldTimeMinutes = START_WORLD_TIME_MINUTES;
  private npcStates: NpcStateMap = createInitialNpcStateMap();

  constructor(map: GameMap, options: GameplayEngineOptions = {}) {
    this.map = map;
    this.resolveZone = options.resolveZone;

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

    const stats = {
      type: "Stats" as const,
      energy: 100,
      maxEnergy: 100,
      currency: 1550,
      attributes: {
        strength: 10,
        intelligence: 10,
        charisma: 10,
      },
      academicTitle: "Novice Scribe",
      academicProgress: 0,
    };
    this.world.addComponent(playerId, stats);

    const inventory: Inventory = {
      type: "Inventory",
      items: [
        { itemId: "academy_notebook", quantity: 1 },
        { itemId: "travel_ration", quantity: 3 },
        { itemId: "chalk_piece", quantity: 2 },
      ],
    };
    this.world.addComponent(playerId, inventory);

    this.spawnNpcs();
    this.spawnItems();

    this.addLog(`Entered ${map.name}.`);
  }

  private spawnNpcs(): void {
    const existingNpcs = this.world.entitiesWith("Npc");
    for (const npcId of existingNpcs) {
      this.world.destroyEntity(npcId);
    }

    for (const npcData of this.map.npcs) {
      const npcDef = getNpcDef(npcData.npcId);
      const presentation = getNpcMapPresentation(npcDef);
      const entityId = this.world.createEntity();

      this.world.addComponent(entityId, {
        type: "Position" as const,
        x: npcData.x,
        y: npcData.y,
      } as Position);

      this.world.addComponent(entityId, {
        type: "Renderable" as const,
        glyph: presentation.glyph,
        color: presentation.color,
      } as Renderable);

      this.world.addComponent(entityId, {
        type: "Npc" as const,
        npcId: npcDef.npcId,
        name: npcDef.name,
        race: npcDef.race,
        importance: npcDef.importance ?? "common",
        dialogue: npcDef.dialogue.map((d) => ({ ...d })),
      } as Npc);
    }
  }

  private spawnItems(): void {
    const existingItems = this.world.entitiesWith("Item");
    for (const itemId of existingItems) {
      this.world.destroyEntity(itemId);
    }

    for (const itemData of this.map.items) {
      const spawnKey = this.getItemSpawnKey(
        this.map.zoneId,
        itemData.itemId,
        itemData.x,
        itemData.y,
      );
      if (this.pickedUpItemSpawnKeys.has(spawnKey)) {
        continue;
      }

      const presentation = getItemMapPresentation(itemData.itemId);
      const entityId = this.world.createEntity();

      this.world.addComponent(entityId, {
        type: "Position" as const,
        x: itemData.x,
        y: itemData.y,
      } as Position);

      this.world.addComponent(entityId, {
        type: "Renderable" as const,
        glyph: presentation.glyph,
        color: presentation.color,
      } as Renderable);

      this.world.addComponent(entityId, {
        type: "Item" as const,
        itemId: itemData.itemId,
        quantity: itemData.quantity,
        spawnKey,
      } as Item);
    }
  }

  /**
   * Applies one player command and returns any immediate UI-facing result.
   *
   * Movement commands update facing and may fail without advancing time when
   * blocked by map geometry or an NPC dialogue collision. Interact checks
   * nearby or direction-limited tiles for contextual actions without moving.
   */
  execute(command: GameCommand): ExecuteResult {
    if (command.type === "Rest") {
      this.restPlayer();
      return { success: true };
    }

    if (command.type === "Interact") {
      return this.interact(command.targetNpcId, command.targetDirection);
    }

    if (command.type === "UseItem") {
      return this.useItem(command.itemId);
    }

    const direction = COMMAND_DIRECTION[command.type];

    if (!direction) {
      return { success: false };
    }

    this.playerFacing = direction;

    const stats = this.getPlayerStats();
    if (stats.energy <= 0) {
      this.addLog(
        "You are too exhausted to move! Rest [R] to recover energy.",
      );
      return { success: false };
    }

    const positionBefore = this.getPlayerPosition();
    const target = this.getTargetPosition(positionBefore, direction);

    const blockingNpc = this.getNpcAt(target.x, target.y);
    if (blockingNpc) {
      return this.talkToNpc(blockingNpc, false);
    }

    const moved = MovementSystem.move(this.world, direction, this.map);

    if (moved) {
      this.tickCounter.advance();
      this.advanceWorldTime(WORLD_TIME_ACTION_COST.movement);
      stats.energy = Math.max(0, stats.energy - 1);
      const pos = this.getPlayerPosition();
      this.addLog(`Moved ${direction} to (${pos.x}, ${pos.y}).`);
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
        return this.talkToNpc(targetNpc, true);
      }

      this.addLog("That interaction target is no longer nearby.");
      return { success: false };
    }

    return this.talkToNpc(adjacentNpcs[0], true);
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

    const energyRestored = CONSUMABLE_ENERGY[itemId];

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
    if (stats.energy >= stats.maxEnergy) {
      const message = `${def.name} would have no effect right now.`;
      this.addLog(message);
      return {
        success: false,
        effects: [
          { type: "ItemUseRejected", itemId, reason: "energy_full", message },
        ],
      };
    }

    const nextEnergy = Math.min(stats.maxEnergy, stats.energy + energyRestored);
    const actualEnergyRestored = nextEnergy - stats.energy;
    stats.energy = nextEnergy;

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
    this.advanceWorldTime(WORLD_TIME_ACTION_COST.dialogue);
    this.addLog(`Talked to ${npc.name}.`);

    return {
      success,
      dialogue: npc.dialogue,
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
    const pos = this.getPlayerPosition();
    const stats = this.getPlayerStats();
    const inventory = this.getPlayerInventory();

    return {
      version: SAVE_VERSION,
      savedAt: new Date().toISOString(),
      zoneId: this.map.zoneId,
      tick: this.tickCounter.tick,
      worldTimeMinutes: this.worldTimeMinutes,
      playerX: pos.x,
      playerY: pos.y,
      playerFacing: this.playerFacing,
      stats: {
        type: "Stats",
        energy: stats.energy,
        maxEnergy: stats.maxEnergy,
        currency: stats.currency,
        attributes: { ...stats.attributes },
        academicTitle: stats.academicTitle,
        academicProgress: stats.academicProgress,
      },
      inventory: {
        type: "Inventory",
        items: inventory.items.map((stack) => ({ ...stack })),
      },
      npcStates: Object.values(this.npcStates).map(cloneNpcState),
      log: this.log.map((entry) => ({ ...entry })),
      pickedUpItemSpawnKeys: Array.from(this.pickedUpItemSpawnKeys),
    };
  }

  /**
   * Creates a GameplayEngine from a previously persisted save.
   *
   * The engine is constructed with the saved zone, then all dynamic state
   * (position, stats, inventory, log, tick, world time, facing, and collected
   * item keys) is restored. The zone's NPCs and uncollected items are
   * respawned via enterZone to respect the saved pickedUpItemSpawnKeys.
   */
  static fromSaveData(
    saveData: GameSaveData,
    options: { resolveZone: ZoneResolver },
  ): GameplayEngine {
    const map = options.resolveZone(saveData.zoneId);

    if (!map) {
      throw new Error(
        `Cannot load save: zone "${saveData.zoneId}" is not available.`,
      );
    }

    const engine = new GameplayEngine(map, options);

    const [playerId] = engine.world.entitiesWith("PlayerControlled");

    const stats = engine.world.getComponent<Stats>(playerId, "Stats")!;
    stats.energy = saveData.stats.energy;
    stats.maxEnergy = saveData.stats.maxEnergy;
    stats.currency = saveData.stats.currency;
    stats.attributes = { ...saveData.stats.attributes };
    stats.academicTitle = saveData.stats.academicTitle;
    stats.academicProgress = saveData.stats.academicProgress;

    const inventory = engine.world.getComponent<Inventory>(
      playerId,
      "Inventory",
    )!;
    inventory.items = saveData.inventory.items.map((stack) => ({ ...stack }));

    engine.tickCounter.restoreTo(saveData.tick);
    engine.worldTimeMinutes = saveData.worldTimeMinutes;
    engine.npcStates = createNpcStateMapFromSave(saveData.npcStates);
    engine.playerFacing = saveData.playerFacing;
    engine.log = saveData.log.map((entry) => ({ ...entry }));
    engine.pickedUpItemSpawnKeys = new Set(saveData.pickedUpItemSpawnKeys);

    engine.spawnNpcs();
    engine.spawnItems();

    const pos = engine.getPlayerPosition();
    pos.x = saveData.playerX;
    pos.y = saveData.playerY;

    return engine;
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
    const stats = this.getPlayerStats();
    stats.energy = Math.min(stats.maxEnergy, stats.energy + 15);
    this.tickCounter.advance();
    this.advanceWorldTime(WORLD_TIME_ACTION_COST.rest);
    this.addLog("Rested and recovered 15 energy.");
  }

  private advanceWorldTime(minutes: number): void {
    this.worldTimeMinutes += minutes;
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
      stats: {
        ...stats,
        attributes: { ...stats.attributes },
      },
      inventory: {
        ...inventory,
        items: inventory.items.map((stack) => ({ ...stack })),
      },
      npcStates: Object.values(this.npcStates).map(cloneNpcState),
      entities,
      entryDialogue: this.map.entryDialogue.map((dialogue) => ({
        ...dialogue,
      })),
    };
  }

  private getPlayerInventory(): Inventory {
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

  private getPlayerPosition(): Position {
    const [playerId] = this.world.entitiesWith("Position", "PlayerControlled");
    return (
      this.world.getComponent<Position>(playerId, "Position") ??
      ({ type: "Position", x: 0, y: 0 } as Position)
    );
  }

  private getTargetPosition(
    pos: Position,
    direction: Direction,
  ): { x: number; y: number } {
    const { dx, dy } = DIRECTION_DELTA[direction];

    return { x: pos.x + dx, y: pos.y + dy };
  }

  private getItemSpawnKey(
    zoneId: string,
    itemId: string,
    x: number,
    y: number,
  ): string {
    return `${zoneId}:${itemId}:${x},${y}`;
  }
}

function createInitialNpcStateMap(): NpcStateMap {
  return Object.fromEntries(
    getAllNpcDefs().map((npcDef) => [
      npcDef.npcId,
      createInitialNpcState(npcDef.npcId),
    ]),
  );
}

function createNpcStateMapFromSave(savedStates: NpcState[]): NpcStateMap {
  const nextStateMap = createInitialNpcStateMap();

  for (const state of savedStates) {
    nextStateMap[state.npcId] = cloneNpcState(state);
  }

  return nextStateMap;
}
