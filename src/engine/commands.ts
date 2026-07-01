export type GameCommand =
  | { type: "MoveNorth" }
  | { type: "MoveSouth" }
  | { type: "MoveWest" }
  | { type: "MoveEast" }
  | { type: "Interact"; targetNpcId?: string }
  | { type: "Rest" };
