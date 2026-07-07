import {
  clearContentOverlay,
  createContentBundle,
  formatContentDiagnostic,
  installContentOverlay,
  validateAllContent,
  type ContentBundle,
} from "../../engine";
import type { CombinedDraftView } from "./editorDraftTypes";

export type EditorPlaytestLaunchResult =
  | { ok: true; contentBundle: ContentBundle }
  | { ok: false; message: string };

export function prepareEditorPlaytest(
  combined: CombinedDraftView,
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
    installContentOverlay(combined.snapshot, combined.context);
    const contentBundle = createContentBundle({
      gameConfig: combined.snapshot.game,
      zones: Object.values(combined.snapshot.zones),
    });
    return { ok: true, contentBundle };
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
