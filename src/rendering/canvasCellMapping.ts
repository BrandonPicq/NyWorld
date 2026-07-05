export type CanvasBox = {
  left: number;
  top: number;
  width: number;
  height: number;
};

export type GridCell = {
  x: number;
  y: number;
};

/**
 * Maps a pointer position to a grid cell using the canvas CSS box.
 *
 * Deriving the cell from getBoundingClientRect (CSS pixels) rather than the
 * canvas backing-store size keeps the mapping correct regardless of
 * devicePixelRatio scaling. Returns null when the pointer falls outside the
 * grid or the box/grid is degenerate.
 */
export function pointerToCell(
  box: CanvasBox,
  gridWidth: number,
  gridHeight: number,
  clientX: number,
  clientY: number,
): GridCell | null {
  if (
    box.width <= 0 ||
    box.height <= 0 ||
    gridWidth <= 0 ||
    gridHeight <= 0
  ) {
    return null;
  }

  const cellWidth = box.width / gridWidth;
  const cellHeight = box.height / gridHeight;
  const x = Math.floor((clientX - box.left) / cellWidth);
  const y = Math.floor((clientY - box.top) / cellHeight);

  if (x < 0 || y < 0 || x >= gridWidth || y >= gridHeight) {
    return null;
  }

  return { x, y };
}
