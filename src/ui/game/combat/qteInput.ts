import type { KeyboardLayout } from "../../controls/keyboardLayout";

export type QteDirection = "up" | "down" | "left" | "right";

/** Glyphs shown for each arrow direction in the QTE minigames. */
export const ARROW_GLYPHS: Record<string, string> = {
  up: "↑",
  down: "↓",
  left: "←",
  right: "→",
};

/**
 * Maps a keydown event to a QTE direction, honoring both arrow keys and the
 * layout-specific letter keys (WASD on qwerty, ZQSD on azerty). Returns null
 * for keys that are not a movement input.
 */
export function mapKeyToDirection(
  e: KeyboardEvent,
  keyboardLayout: KeyboardLayout,
): QteDirection | null {
  const key = e.key.toLowerCase();

  if (
    e.key === "ArrowUp" ||
    (keyboardLayout === "azerty" ? key === "z" : key === "w")
  ) {
    return "up";
  }
  if (e.key === "ArrowDown" || key === "s") {
    return "down";
  }
  if (
    e.key === "ArrowLeft" ||
    (keyboardLayout === "azerty" ? key === "q" : key === "a")
  ) {
    return "left";
  }
  if (e.key === "ArrowRight" || key === "d") {
    return "right";
  }

  return null;
}
