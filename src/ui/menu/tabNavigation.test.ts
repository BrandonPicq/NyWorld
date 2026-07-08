import { describe, expect, it } from "vitest";
import { getNextTabIndex, resolveTabKeyAction } from "./tabNavigation";

describe("tab navigation", () => {
  it("maps horizontal arrows to tab movement", () => {
    expect(resolveTabKeyAction("ArrowLeft", { tabCount: 5 })).toEqual({
      kind: "move",
      direction: -1,
    });
    expect(resolveTabKeyAction("ArrowRight", { tabCount: 5 })).toEqual({
      kind: "move",
      direction: 1,
    });
  });

  it("maps numeric keys to one-based tab indexes", () => {
    expect(resolveTabKeyAction("1", { tabCount: 5 })).toEqual({
      kind: "select",
      index: 0,
    });
    expect(resolveTabKeyAction("5", { tabCount: 5 })).toEqual({
      kind: "select",
      index: 4,
    });
    expect(resolveTabKeyAction("6", { tabCount: 5 })).toEqual({ kind: "none" });
  });

  it("only handles Escape when a cancel action exists", () => {
    expect(resolveTabKeyAction("Escape", { tabCount: 5 })).toEqual({
      kind: "none",
    });
    expect(
      resolveTabKeyAction("Escape", { tabCount: 5, hasCancel: true }),
    ).toEqual({ kind: "cancel" });
  });

  it("wraps tab indexes", () => {
    expect(getNextTabIndex(0, 5, -1)).toBe(4);
    expect(getNextTabIndex(4, 5, 1)).toBe(0);
    expect(getNextTabIndex(2, 5, 1)).toBe(3);
    expect(getNextTabIndex(0, 0, 1)).toBe(-1);
  });
});
