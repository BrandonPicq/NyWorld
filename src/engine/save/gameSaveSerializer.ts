import type { GameSaveData } from "../GameSaveData";
import { SAVE_VERSION } from "../GameSaveData";
import type { Inventory, Position, Stats } from "../components";
import type { LogEntry } from "../LogEntry";
import { cloneNpcState, type NpcState } from "../npcs/NpcState";
import type { Direction } from "../systems/MovementSystem";

/**
 * Minimal state required to build a save payload.
 *
 * Keeping this as explicit data prevents the serializer from depending on the
 * full GameplayEngine class or reaching into mutable engine internals.
 */
export interface SaveSerializationState {
  zoneId: string;
  tick: number;
  worldTimeMinutes: number;
  playerPosition: Position;
  playerFacing: Direction;
  stats: Stats;
  inventory: Inventory;
  npcStates: Iterable<NpcState>;
  log: LogEntry[];
  pickedUpItemSpawnKeys: Iterable<string>;
}

/**
 * Converts current runtime state into detached, versioned save data.
 */
export function serializeSaveData(state: SaveSerializationState): GameSaveData {
  const { inventory, playerPosition, stats } = state;

  return {
    version: SAVE_VERSION,
    savedAt: new Date().toISOString(),
    zoneId: state.zoneId,
    tick: state.tick,
    worldTimeMinutes: state.worldTimeMinutes,
    playerX: playerPosition.x,
    playerY: playerPosition.y,
    playerFacing: state.playerFacing,
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
    npcStates: Array.from(state.npcStates, cloneNpcState),
    log: state.log.map((entry) => ({ ...entry })),
    pickedUpItemSpawnKeys: Array.from(state.pickedUpItemSpawnKeys),
  };
}
