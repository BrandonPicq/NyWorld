import { describe, expect, it } from "vitest";
import {
  getGameCommandForKey,
  getGameUiShortcutForKey,
  getInteractKeyLabel,
  getMovementKeyLabel,
} from "./gameInput";

describe("game input mapping", () => {
  it("maps arrow keys independently from keyboard layout", () => {
    expect(getGameCommandForKey("ArrowUp", "qwerty")).toBe("MoveNorth");
    expect(getGameCommandForKey("ArrowDown", "azerty")).toBe("MoveSouth");
    expect(getGameCommandForKey("ArrowLeft", "qwerty")).toBe("MoveWest");
    expect(getGameCommandForKey("ArrowRight", "azerty")).toBe("MoveEast");
  });

  it("maps QWERTY movement keys", () => {
    expect(getGameCommandForKey("w", "qwerty")).toBe("MoveNorth");
    expect(getGameCommandForKey("a", "qwerty")).toBe("MoveWest");
    expect(getGameCommandForKey("s", "qwerty")).toBe("MoveSouth");
    expect(getGameCommandForKey("d", "qwerty")).toBe("MoveEast");
  });

  it("maps AZERTY movement keys", () => {
    expect(getGameCommandForKey("z", "azerty")).toBe("MoveNorth");
    expect(getGameCommandForKey("q", "azerty")).toBe("MoveWest");
    expect(getGameCommandForKey("s", "azerty")).toBe("MoveSouth");
    expect(getGameCommandForKey("d", "azerty")).toBe("MoveEast");
  });

  it("normalizes letter casing", () => {
    expect(getGameCommandForKey("W", "qwerty")).toBe("MoveNorth");
    expect(getGameCommandForKey("Z", "azerty")).toBe("MoveNorth");
  });

  it("keeps layout-specific keys exclusive", () => {
    expect(getGameCommandForKey("w", "azerty")).toBeUndefined();
    expect(getGameCommandForKey("z", "qwerty")).toBeUndefined();
  });

  it("returns no command for unsupported keys", () => {
    expect(getGameCommandForKey("Enter", "qwerty")).toBeUndefined();
  });

  it("does not map rest as a movement command", () => {
    expect(getGameCommandForKey("r", "qwerty")).toBeUndefined();
    expect(getGameCommandForKey("r", "azerty")).toBeUndefined();
  });

  it("maps interact independently from keyboard layout", () => {
    expect(getGameCommandForKey("e", "qwerty")).toBe("Interact");
    expect(getGameCommandForKey("E", "azerty")).toBe("Interact");
  });

  it("returns movement key labels for the active layout", () => {
    expect(getMovementKeyLabel("MoveNorth", "qwerty")).toBe("W");
    expect(getMovementKeyLabel("MoveNorth", "azerty")).toBe("Z");
    expect(getMovementKeyLabel("MoveWest", "qwerty")).toBe("A");
    expect(getMovementKeyLabel("MoveWest", "azerty")).toBe("Q");
  });

  it("returns the interact key label", () => {
    expect(getInteractKeyLabel()).toBe("E");
  });

  it("maps L to the logs surface", () => {
    expect(getGameUiShortcutForKey("l")).toBe("logs");
    expect(getGameUiShortcutForKey("L")).toBe("logs");
    expect(getGameUiShortcutForKey("k")).toBeUndefined();
  });
});
