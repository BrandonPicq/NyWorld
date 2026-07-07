import {
  clearContentOverlay,
  createContentBundle,
  formatContentDiagnostic,
  installContentOverlay,
  validateAllContent,
  type ContentBundle,
} from "../../engine";
import type { CombinedDraftView } from "./editorDraftTypes";
import {
  resolveEditorPlaytestStart,
  type EditorPlaytestStart,
} from "./playtestStart";

export type EditorPlaytestLaunchResult =
  | { ok: true; contentBundle: ContentBundle; start: EditorPlaytestStart }
  | { ok: false; message: string };

export type EditorPlaytestLaunchOptions = {
  selectedZoneId: string;
  pinnedInspectCell?: { x: number; y: number } | null;
};

export function prepareEditorPlaytest(
  combined: CombinedDraftView,
  options: EditorPlaytestLaunchOptions,
): EditorPlaytestLaunchResult {
  const diagnostics = validateAllContent(combined.snapshot, combined.context);
  const firstError = diagnostics.find(
    (diagnostic) => diagnostic.severity === "error",
  );

  if (firstError) {
    return {
      ok: false,
      message: formatContentDiagnostic(firstError),
    };
  }

  try {
    const start = resolveEditorPlaytestStart({
      snapshot: combined.snapshot,
      selectedZoneId: options.selectedZoneId,
      pinnedInspectCell: options.pinnedInspectCell,
    });
    installContentOverlay(combined.snapshot, combined.context);
    const contentBundle = createContentBundle({
      gameConfig: combined.snapshot.game,
      zones: Object.values(combined.snapshot.zones),
    });
    return { ok: true, contentBundle, start };
  } catch (error) {
    clearContentOverlay();
    return {
      ok: false,
      message:
        error instanceof Error
          ? error.message
          : "Cannot launch playtest from the current draft.",
    };
  }
}
