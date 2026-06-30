export type GameCommand =
  | { type: "MoveNorth" }
  | { type: "MoveSouth" }
  | { type: "MoveWest" }
  | { type: "MoveEast" };
