import { describe, expect, it } from "vitest";
import { getNextFocusTrapIndex } from "./focusTrap";

describe("focus trap helpers", () => {
  it("cycles focus forward and backward", () => {
    expect(getNextFocusTrapIndex(0, 3, 1)).toBe(1);
    expect(getNextFocusTrapIndex(2, 3, 1)).toBe(0);
    expect(getNextFocusTrapIndex(0, 3, -1)).toBe(2);
  });

  it("starts at an edge when current focus is outside the trap", () => {
    expect(getNextFocusTrapIndex(-1, 3, 1)).toBe(0);
    expect(getNextFocusTrapIndex(-1, 3, -1)).toBe(2);
  });

  it("returns no target for an empty trap", () => {
    expect(getNextFocusTrapIndex(0, 0, 1)).toBe(-1);
  });
});
