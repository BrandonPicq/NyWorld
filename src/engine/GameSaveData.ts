import type { Direction } from "./systems/MovementSystem";
import type { Inventory, Stats } from "./components";
import type { LogEntry } from "./GameplayEngine";

export const SAVE_VERSION = "0.1";

export interface GameSaveData {
  version: string;
  savedAt: string;
  zoneId: string;
  tick: number;
  playerX: number;
  playerY: number;
  playerFacing: Direction;
  stats: Stats;
  inventory: Inventory;
  log: LogEntry[];
  pickedUpItemSpawnKeys: string[];
}
