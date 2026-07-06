import { describe, expect, it } from "vitest";
import { pointerToCell, computeFitCellSize } from "./canvasCellMapping";

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

describe("computeFitCellSize", () => {
  it("computes cell size and clamps it", () => {
    // container: 320x256, grid: 10x8. Fit cell sizes: 320/10 = 32, 256/8 = 32. Clamps to [20, 64] -> 32
    expect(computeFitCellSize(320, 256, 10, 8, { min: 20, max: 64 })).toBe(32);

    // clamps to max: container: 1000x800, grid: 10x8 -> sizes: 100, 100. Clamps to max 64 -> 64
    expect(computeFitCellSize(1000, 800, 10, 8, { min: 20, max: 64 })).toBe(64);

    // clamps to min: container: 100x80, grid: 10x8 -> sizes: 10, 10. Clamps to min 20 -> 20
    expect(computeFitCellSize(100, 80, 10, 8, { min: 20, max: 64 })).toBe(20);

    // non-square fit: container: 400x200, grid: 10x10 -> width-based: 40, height-based: 20 -> min is 20 -> 20
    expect(computeFitCellSize(400, 200, 10, 10, { min: 10, max: 50 })).toBe(20);
  });

  it("handles degenerate sizes gracefully by returning min", () => {
    expect(computeFitCellSize(0, 256, 10, 8, { min: 20, max: 64 })).toBe(20);
    expect(computeFitCellSize(320, 0, 10, 8, { min: 20, max: 64 })).toBe(20);
    expect(computeFitCellSize(320, 256, 0, 8, { min: 20, max: 64 })).toBe(20);
    expect(computeFitCellSize(320, 256, 10, 0, { min: 20, max: 64 })).toBe(20);
  });
});
