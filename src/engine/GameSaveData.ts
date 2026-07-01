import type { Direction } from "./systems/MovementSystem";
import type { Inventory, Stats } from "./components";
import type { LogEntry } from "./GameplayEngine";
import type { NpcState } from "./npcs/NpcState";

export const SAVE_VERSION = "0.3";

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
