import type { Direction } from "./systems";

export type GameCommand =
  | { type: "MoveNorth" }
  | { type: "MoveSouth" }
  | { type: "MoveWest" }
  | { type: "MoveEast" }
  | { type: "Interact"; targetNpcId?: string; targetDirection?: Direction }
  | { type: "Rest" };
