import type { EquippedSlot } from "../../../engine";

export const EQUIPMENT_SLOT_GRID: Array<Array<EquippedSlot | null>> = [
  [null, "head", null],
  ["accessory1", "body", "accessory2"],
  ["weapon", "hands", "offHand"],
  [null, "feet", null],
];

export function resolveEquipmentSlotMove(
  currentSlot: EquippedSlot,
  key: string,
): EquippedSlot | null {
  const delta = getMoveDelta(key);
  if (!delta) {
    return null;
  }

  const position = findSlotPosition(currentSlot);
  if (!position) {
    return null;
  }

  const [row, col] = position;
  return findNearestSlot(row, col, delta.row, delta.col);
}

function getMoveDelta(key: string): { row: -1 | 0 | 1; col: -1 | 0 | 1 } | null {
  switch (key) {
    case "ArrowUp":
      return { row: -1, col: 0 };
    case "ArrowDown":
      return { row: 1, col: 0 };
    case "ArrowLeft":
      return { row: 0, col: -1 };
    case "ArrowRight":
      return { row: 0, col: 1 };
    default:
      return null;
  }
}

function findSlotPosition(slot: EquippedSlot): [number, number] | null {
  for (let row = 0; row < EQUIPMENT_SLOT_GRID.length; row += 1) {
    const col = EQUIPMENT_SLOT_GRID[row].indexOf(slot);
    if (col >= 0) {
      return [row, col];
    }
  }
  return null;
}

function findNearestSlot(
  row: number,
  col: number,
  rowDelta: -1 | 0 | 1,
  colDelta: -1 | 0 | 1,
): EquippedSlot | null {
  let nextRow = row + rowDelta;
  let nextCol = col + colDelta;

  while (
    nextRow >= 0 &&
    nextRow < EQUIPMENT_SLOT_GRID.length &&
    nextCol >= 0 &&
    nextCol < EQUIPMENT_SLOT_GRID[nextRow].length
  ) {
    const slot = EQUIPMENT_SLOT_GRID[nextRow][nextCol];
    if (slot) {
      return slot;
    }
    nextRow += rowDelta;
    nextCol += colDelta;
  }

  return null;
}
