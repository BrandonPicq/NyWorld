import { describe, expect, it } from "vitest";
import { pointerToCell } from "./canvasCellMapping";

const box = { left: 100, top: 50, width: 320, height: 256 };

describe("pointerToCell", () => {
  it("maps a pointer inside the box to a cell using CSS size", () => {
    // 320/10 = 32px cells; (100+40, 50+40) -> cell (1, 1)
    expect(pointerToCell(box, 10, 8, 140, 90)).toEqual({ x: 1, y: 1 });
  });

  it("maps the top-left corner to cell (0, 0)", () => {
    expect(pointerToCell(box, 10, 8, 100, 50)).toEqual({ x: 0, y: 0 });
  });

  it("maps the bottom-right-most pixel to the last cell", () => {
    expect(pointerToCell(box, 10, 8, 419, 305)).toEqual({ x: 9, y: 7 });
  });

  it("stays correct when the canvas is scaled down (rect smaller than grid px)", () => {
    // A 10-wide grid shown in a 100px box -> 10px cells.
    const scaled = { left: 0, top: 0, width: 100, height: 80 };
    expect(pointerToCell(scaled, 10, 8, 55, 25)).toEqual({ x: 5, y: 2 });
  });

  it("returns null outside the grid", () => {
    expect(pointerToCell(box, 10, 8, 99, 90)).toBeNull();
    expect(pointerToCell(box, 10, 8, 140, 49)).toBeNull();
    expect(pointerToCell(box, 10, 8, 420, 90)).toBeNull();
    expect(pointerToCell(box, 10, 8, 140, 306)).toBeNull();
  });

  it("returns null for a degenerate box or grid", () => {
    expect(pointerToCell({ ...box, width: 0 }, 10, 8, 140, 90)).toBeNull();
    expect(pointerToCell(box, 0, 8, 140, 90)).toBeNull();
  });
});
