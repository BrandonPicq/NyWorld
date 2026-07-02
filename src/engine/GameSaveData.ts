import type { Direction } from "./systems/MovementSystem";
import type { Inventory, Stats } from "./components";
import type { LogEntry } from "./LogEntry";
import type { NpcState } from "./npcs/NpcState";

/**
 * Current schema version for serialized saves.
 *
 * Increment this when older save payloads can no longer be safely interpreted
 * by the loader without migration.
 */
export const SAVE_VERSION = "0.3";

/**
 * Versioned payload written to persistent save slots.
 *
 * Save data stores mutable playthrough state. Static content such as map
 * geometry, item definitions, NPC definitions, and dialogue text is loaded
 * again from registries when the game is restored.
 */
export interface GameSaveData {
  version: string;
  savedAt: string;
  zoneId: string;
  tick: number;
  worldTimeMinutes: number;
  playerX: number;
  playerY: number;
  playerFacing: Direction;
  stats: Stats;
  inventory: Inventory;
  npcStates: NpcState[];
  log: LogEntry[];
  pickedUpItemSpawnKeys: string[];
}
