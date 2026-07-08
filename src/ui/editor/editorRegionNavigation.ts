export type EditorRegionKeyAction =
  | { kind: "enter" }
  | { kind: "move"; direction: -1 | 1 }
  | { kind: "previous" }
  | { kind: "none" };

export function resolveEditorRegionKeyAction(
  key: string,
  options: { regionCount: number },
): EditorRegionKeyAction {
  if (key === "Escape") {
    return { kind: "previous" };
  }

  if (options.regionCount <= 0) {
    return { kind: "none" };
  }

  if (
    key === "ArrowLeft" ||
    key === "ArrowUp"
  ) {
    return { kind: "move", direction: -1 };
  }

  if (
    key === "ArrowRight" ||
    key === "ArrowDown"
  ) {
    return { kind: "move", direction: 1 };
  }

  if (key === "Enter") {
    return { kind: "enter" };
  }

  return { kind: "none" };
}

export function getNextEditorRegionIndex(
  currentIndex: number,
  regionCount: number,
  direction: -1 | 1,
): number {
  if (regionCount <= 0) {
    return -1;
  }
  return (currentIndex + direction + regionCount) % regionCount;
}
