import type { Dispatch, SetStateAction } from "react";
import type {
  ContentCatalogSnapshot,
  ContentDiagnostic,
  ContentReferenceGraph,
  ContentValidationContext,
} from "../../engine";

/**
 * The one combined whole-bundle view every editor tab validates against.
 *
 * `useEditorDrafts` builds it from every family's live draft, so a tab's
 * diagnostics and reference graph see cross-tab unsaved edits. Diagnostics are
 * deferred off the typing path; the snapshot and context stay live so saves can
 * re-validate synchronously.
 */
export interface CombinedDraftView {
  snapshot: ContentCatalogSnapshot;
  context: ContentValidationContext;
  diagnostics: ContentDiagnostic[];
  graph: ContentReferenceGraph;
  errorCount: number;
  warningCount: number;
}

/** A single lifted piece of draft state owned by `useEditorDrafts`. */
export interface DraftSlot<T> {
  value: T;
  set: Dispatch<SetStateAction<T>>;
}
