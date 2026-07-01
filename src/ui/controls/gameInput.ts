import type { GameCommand } from "../../engine/commands";
import type { KeyboardLayout } from "./keyboardLayout";

export type MovementCommandType = Exclude<GameCommand["type"], "Rest">;

const arrowKeyCommands: Record<string, MovementCommandType> = {
  ArrowUp: "MoveNorth",
  ArrowDown: "MoveSouth",
  ArrowLeft: "MoveWest",
  ArrowRight: "MoveEast",
};

const layoutKeyCommands: Record<
  KeyboardLayout,
  Record<string, MovementCommandType>
> = {
  azerty: {
    d: "MoveEast",
    q: "MoveWest",
    s: "MoveSouth",
    z: "MoveNorth",
  },
  qwerty: {
    a: "MoveWest",
    d: "MoveEast",
    s: "MoveSouth",
    w: "MoveNorth",
  },
};

const movementKeyLabels: Record<
  KeyboardLayout,
  Record<MovementCommandType, string>
> = {
  azerty: {
    MoveEast: "D",
    MoveNorth: "Z",
    MoveSouth: "S",
    MoveWest: "Q",
  },
  qwerty: {
    MoveEast: "D",
    MoveNorth: "W",
    MoveSouth: "S",
    MoveWest: "A",
  },
};

/**
 * Maps browser keyboard events to movement commands for arrow keys and layout keys.
 */
export function getGameCommandForKey(
  key: string,
  layout: KeyboardLayout,
): MovementCommandType | undefined {
  return arrowKeyCommands[key] ?? layoutKeyCommands[layout][key.toLowerCase()];
}

/**
 * Returns the player-facing key label for a movement command in the active layout.
 */
export function getMovementKeyLabel(
  commandType: MovementCommandType,
  layout: KeyboardLayout,
): string {
  return movementKeyLabels[layout][commandType];
}
