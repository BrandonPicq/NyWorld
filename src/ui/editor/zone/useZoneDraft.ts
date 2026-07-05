import { useMemo, useState } from "react";
import {
  createRuntimeContentValidationContext,
  validateAllContent,
  type ContentCatalogSnapshot,
  type ContentDiagnostic,
  type ZoneData,
} from "../../../engine";
import type { GridRenderSnapshot } from "../../../rendering/renderSnapshot";
import { createZoneEditRenderSnapshot } from "../../../rendering/zoneEditRenderSnapshot";
import { saveEditorContent } from "../editorSaveClient";
import type { SaveStatus } from "../editorModel";
import {
  cloneZoneData,
  createZoneDraftSnapshot,
  createZoneDraftValidationContext,
  serializeZoneData,
  zoneContentPath,
} from "./zoneEditorModel";

/**
 * Edit-draft state for one zone: the working copy, whole-bundle validation, and
 * save. Placement selection (which edit a click performs) lives separately.
 *
 * Callers mount this behind a `key={zoneId}` so switching zones remounts with a
 * fresh draft (unsaved edits are discarded on switch — a noted follow-up).
 */
export interface ZoneDraftController {
  renderSnapshot: GridRenderSnapshot;
  draft: ZoneData;
  diagnostics: ContentDiagnostic[];
  errorCount: number;
  updateDraft: (updater: (zone: ZoneData) => ZoneData) => void;
  hasUnsavedChanges: boolean;
  canSave: boolean;
  isSaving: boolean;
  saveStatus: SaveStatus;
  canUndo: boolean;
  canRedo: boolean;
  undo: () => void;
  redo: () => void;
  resetDraft: () => void;
  saveDraft: () => Promise<void>;
}

interface ZoneHistory {
  past: ZoneData[];
  present: ZoneData;
  future: ZoneData[];
}

export function useZoneDraft(
  zone: ZoneData,
  snapshot: ContentCatalogSnapshot,
): ZoneDraftController {
  const context = useMemo(() => createRuntimeContentValidationContext(), []);

  const [history, setHistory] = useState<ZoneHistory>(() => ({
    past: [],
    present: cloneZoneData(zone),
    future: [],
  }));
  const draft = history.present;
  const [savedJson, setSavedJson] = useState(() => serializeZoneData(zone));
  const [saveStatus, setSaveStatus] = useState<SaveStatus>({
    state: "idle",
    message: "",
  });

  // Validate against the whole bundle so cross-zone breakage shows up too — for
  // example painting a wall where a global NPC's schedule walks into this zone.
  const diagnostics = useMemo(
    () =>
      validateAllContent(
        createZoneDraftSnapshot(snapshot, draft),
        createZoneDraftValidationContext(context, draft),
      ),
    [snapshot, draft, context],
  );
  const errorCount = diagnostics.filter(
    (diagnostic) => diagnostic.severity === "error",
  ).length;
  const renderSnapshot = useMemo(
    () => createZoneEditRenderSnapshot(draft),
    [draft],
  );
  const serialized = useMemo(() => serializeZoneData(draft), [draft]);
  const hasUnsavedChanges = serialized !== savedJson;
  const isSaving = saveStatus.state === "saving";
  const canSave = hasUnsavedChanges && errorCount === 0 && !isSaving;
  const canUndo = history.past.length > 0;
  const canRedo = history.future.length > 0;

  const displayStatus: SaveStatus =
    saveStatus.state === "idle"
      ? {
          state: "idle",
          message: hasUnsavedChanges ? "Unsaved changes." : "No changes.",
        }
      : saveStatus;

  // Clear a lingering "saved"/"error" message once editing resumes; the
  // functional update bails out (same reference) while already idle, so a drag
  // does not churn state after the first cell.
  function markEditing(): void {
    setSaveStatus((prev) =>
      prev.state === "idle" ? prev : { state: "idle", message: "" },
    );
  }

  function updateDraft(updater: (zone: ZoneData) => ZoneData): void {
    setHistory((current) => {
      const next = updater(current.present);
      if (next === current.present) {
        return current;
      }
      return {
        past: [...current.past, current.present],
        present: next,
        future: [],
      };
    });
    markEditing();
  }

  function undo(): void {
    setHistory((current) => {
      if (current.past.length === 0) {
        return current;
      }
      return {
        past: current.past.slice(0, -1),
        present: current.past[current.past.length - 1],
        future: [current.present, ...current.future],
      };
    });
    markEditing();
  }

  function redo(): void {
    setHistory((current) => {
      if (current.future.length === 0) {
        return current;
      }
      return {
        past: [...current.past, current.present],
        present: current.future[0],
        future: current.future.slice(1),
      };
    });
    markEditing();
  }

  function resetDraft(): void {
    // Reset is undoable: the current draft is pushed onto the history first.
    setHistory((current) => ({
      past: [...current.past, current.present],
      present: cloneZoneData(zone),
      future: [],
    }));
    setSavedJson(serializeZoneData(zone));
    setSaveStatus({ state: "idle", message: "" });
  }

  async function saveDraft(): Promise<void> {
    if (!hasUnsavedChanges) {
      setSaveStatus({ state: "idle", message: "" });
      return;
    }

    if (errorCount > 0) {
      setSaveStatus({
        state: "error",
        message: "Resolve errors before saving.",
      });
      return;
    }

    const content = serialized;
    setSaveStatus({ state: "saving", message: "Saving..." });
    const result = await saveEditorContent(
      zoneContentPath(zone.zoneId),
      content,
    );
    if (!result.ok) {
      setSaveStatus({ state: "error", message: result.error });
      return;
    }

    setSavedJson(content);
    setSaveStatus({ state: "saved", message: `Saved ${result.path}.` });
  }

  return {
    renderSnapshot,
    draft,
    diagnostics,
    errorCount,
    updateDraft,
    hasUnsavedChanges,
    canSave,
    isSaving,
    saveStatus: displayStatus,
    canUndo,
    canRedo,
    undo,
    redo,
    resetDraft,
    saveDraft,
  };
}
