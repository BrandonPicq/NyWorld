import type { GameCommand } from "../../engine/commands";
import type { KeyboardLayout } from "./keyboardLayout";

export type MovementCommandType = Extract<
  GameCommand["type"],
  "MoveNorth" | "MoveSouth" | "MoveWest" | "MoveEast"
>;
export type KeyboardGameCommandType = MovementCommandType | "Interact";
export type GameUiShortcut = "logs";

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
): KeyboardGameCommandType | undefined {
  const normalizedKey = key.toLowerCase();

  if (normalizedKey === "e") {
    return "Interact";
  }

  return arrowKeyCommands[key] ?? layoutKeyCommands[layout][normalizedKey];
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

/**
 * Returns the player-facing key label for the contextual interaction command.
 */
export function getInteractKeyLabel(): string {
  return "E";
}

/** Returns the keyboard shortcut for non-gameplay game-screen surfaces. */
export function getGameUiShortcutForKey(key: string): GameUiShortcut | undefined {
  return key.toLowerCase() === "l" ? "logs" : undefined;
}
