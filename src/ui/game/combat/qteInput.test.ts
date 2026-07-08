import { describe, expect, it } from "vitest";
import { mapKeyToDirection } from "./qteInput";

function keyEvent(key: string): KeyboardEvent {
  return { key } as unknown as KeyboardEvent;
}

describe("mapKeyToDirection", () => {
  it("maps arrow keys regardless of layout", () => {
    expect(mapKeyToDirection(keyEvent("ArrowUp"), "qwerty")).toBe("up");
    expect(mapKeyToDirection(keyEvent("ArrowDown"), "azerty")).toBe("down");
    expect(mapKeyToDirection(keyEvent("ArrowLeft"), "qwerty")).toBe("left");
    expect(mapKeyToDirection(keyEvent("ArrowRight"), "azerty")).toBe("right");
  });

  it("maps WASD on a qwerty layout", () => {
    expect(mapKeyToDirection(keyEvent("w"), "qwerty")).toBe("up");
    expect(mapKeyToDirection(keyEvent("a"), "qwerty")).toBe("left");
    expect(mapKeyToDirection(keyEvent("s"), "qwerty")).toBe("down");
    expect(mapKeyToDirection(keyEvent("d"), "qwerty")).toBe("right");
  });

  it("maps ZQSD on an azerty layout", () => {
    expect(mapKeyToDirection(keyEvent("z"), "azerty")).toBe("up");
    expect(mapKeyToDirection(keyEvent("q"), "azerty")).toBe("left");
    expect(mapKeyToDirection(keyEvent("s"), "azerty")).toBe("down");
    expect(mapKeyToDirection(keyEvent("d"), "azerty")).toBe("right");
  });

  it("does not treat the other layout's letters as movement", () => {
    // w/a are not azerty movement keys; z/q are not qwerty movement keys
    expect(mapKeyToDirection(keyEvent("z"), "qwerty")).toBeNull();
    expect(mapKeyToDirection(keyEvent("q"), "qwerty")).toBeNull();
    expect(mapKeyToDirection(keyEvent("w"), "azerty")).toBeNull();
    expect(mapKeyToDirection(keyEvent("a"), "azerty")).toBeNull();
  });

  it("returns null for unrelated keys", () => {
    expect(mapKeyToDirection(keyEvent("Enter"), "qwerty")).toBeNull();
    expect(mapKeyToDirection(keyEvent("x"), "qwerty")).toBeNull();
  });

  it("is case-insensitive for letter keys", () => {
    expect(mapKeyToDirection(keyEvent("W"), "qwerty")).toBe("up");
    expect(mapKeyToDirection(keyEvent("D"), "azerty")).toBe("right");
  });
});
