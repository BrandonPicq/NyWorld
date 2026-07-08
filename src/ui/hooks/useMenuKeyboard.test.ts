import { describe, expect, it } from "vitest";
import { resolveMenuKeyAction } from "./useMenuKeyboard";

const baseOptions = {
  itemCount: 3,
  enableDirectionalLetterKeys: true,
  hasCancel: true,
};

describe("resolveMenuKeyAction", () => {
  it("maps Escape to cancel when a cancel handler exists", () => {
    expect(resolveMenuKeyAction("Escape", baseOptions)).toEqual({
      kind: "cancel",
    });
  });

  it("leaves Escape unhandled without a cancel handler", () => {
    expect(
      resolveMenuKeyAction("Escape", { ...baseOptions, hasCancel: false }),
    ).toEqual({ kind: "none" });
  });

  it("cancels on Escape even when the list is empty", () => {
    expect(
      resolveMenuKeyAction("Escape", { ...baseOptions, itemCount: 0 }),
    ).toEqual({ kind: "cancel" });
  });

  it("maps arrows and directional letters to moves", () => {
    expect(resolveMenuKeyAction("ArrowDown", baseOptions)).toEqual({
      kind: "move",
      direction: 1,
    });
    expect(resolveMenuKeyAction("ArrowUp", baseOptions)).toEqual({
      kind: "move",
      direction: -1,
    });
    expect(resolveMenuKeyAction("s", baseOptions)).toEqual({
      kind: "move",
      direction: 1,
    });
    expect(resolveMenuKeyAction("Z", baseOptions)).toEqual({
      kind: "move",
      direction: -1,
    });
    expect(resolveMenuKeyAction("w", baseOptions)).toEqual({
      kind: "move",
      direction: -1,
    });
  });

  it("ignores directional letters when disabled", () => {
    const options = { ...baseOptions, enableDirectionalLetterKeys: false };
    expect(resolveMenuKeyAction("s", options)).toEqual({ kind: "none" });
    expect(resolveMenuKeyAction("ArrowDown", options)).toEqual({
      kind: "move",
      direction: 1,
    });
  });

  it("maps Enter to confirm and declared extra keys to extra", () => {
    expect(resolveMenuKeyAction("Enter", baseOptions)).toEqual({
      kind: "confirm",
    });
    expect(
      resolveMenuKeyAction("E", { ...baseOptions, extraKeys: ["e", "u"] }),
    ).toEqual({ kind: "extra", key: "e" });
  });

  it("leaves undeclared keys unhandled so global shortcuts keep working", () => {
    expect(resolveMenuKeyAction("i", baseOptions)).toEqual({ kind: "none" });
    expect(resolveMenuKeyAction("c", baseOptions)).toEqual({ kind: "none" });
    expect(
      resolveMenuKeyAction("e", { ...baseOptions, extraKeys: ["u"] }),
    ).toEqual({ kind: "none" });
  });

  it("only handles Escape when the list is empty", () => {
    const options = { ...baseOptions, itemCount: 0, extraKeys: ["e"] };
    expect(resolveMenuKeyAction("ArrowDown", options)).toEqual({
      kind: "none",
    });
    expect(resolveMenuKeyAction("Enter", options)).toEqual({ kind: "none" });
    expect(resolveMenuKeyAction("e", options)).toEqual({ kind: "none" });
  });
});
