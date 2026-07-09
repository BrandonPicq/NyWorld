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

const FOCUS_RECOVERY_KEYS = new Set([
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "Enter",
  "Escape",
]);

/**
 * Keys that should pull keyboard focus back into the editor when focus was
 * lost to the document body (background click, focused element unmounting).
 */
export function isEditorFocusRecoveryKey(key: string): boolean {
  return FOCUS_RECOVERY_KEYS.has(key);
}

const VERTICAL_ARROW_OWNING_INPUT_TYPES = new Set([
  "range",
  "radio",
  "date",
  "time",
  "datetime-local",
  "month",
  "week",
]);

/**
 * Whether a focused form control needs ArrowUp/ArrowDown to operate at all
 * and must keep them instead of letting the editor move focus to a sibling
 * control. Selects and number inputs are deliberately excluded: arrows would
 * silently change their value while merely passing over them, so they are
 * traversed instead (selects open with Enter or Space, numbers are typed).
 */
export function controlOwnsVerticalArrowKeys(
  tagName: string,
  inputType: string | null,
): boolean {
  const tag = tagName.toLowerCase();
  if (tag === "textarea") {
    return true;
  }
  return (
    tag === "input" &&
    VERTICAL_ARROW_OWNING_INPUT_TYPES.has((inputType ?? "text").toLowerCase())
  );
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
