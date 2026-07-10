export type TabKeyAction =
  | { kind: "move"; direction: -1 | 1 }
  | { kind: "select"; index: number }
  | { kind: "cancel" }
  | { kind: "none" };

export type TabOrientation = "horizontal" | "vertical";

export function resolveTabKeyAction(
  key: string,
  options: {
    tabCount: number;
    hasCancel?: boolean;
    orientation?: TabOrientation;
  },
): TabKeyAction {
  if (key === "Escape") {
    return options.hasCancel ? { kind: "cancel" } : { kind: "none" };
  }

  if (options.tabCount <= 0) {
    return { kind: "none" };
  }

  const orientation = options.orientation ?? "horizontal";
  const previousKey = orientation === "horizontal" ? "ArrowLeft" : "ArrowUp";
  const nextKey = orientation === "horizontal" ? "ArrowRight" : "ArrowDown";

  if (key === previousKey) {
    return { kind: "move", direction: -1 };
  }
  if (key === nextKey) {
    return { kind: "move", direction: 1 };
  }

  const numericIndex = Number.parseInt(key, 10);
  if (
    Number.isInteger(numericIndex) &&
    numericIndex >= 1 &&
    numericIndex <= options.tabCount
  ) {
    return { kind: "select", index: numericIndex - 1 };
  }

  return { kind: "none" };
}

export function getNextTabIndex(
  currentIndex: number,
  tabCount: number,
  direction: -1 | 1,
): number {
  if (tabCount <= 0) {
    return -1;
  }

  return (currentIndex + direction + tabCount) % tabCount;
}
