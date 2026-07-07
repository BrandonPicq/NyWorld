import { useMemo, useState } from "react";
import type {
  ContentCatalogSnapshot,
  ContentDiagnostic,
  ZoneData,
} from "../../../engine";
import type { GridCell } from "../../../rendering/canvasCellMapping";
import type { GridRenderSnapshot } from "../../../rendering/renderSnapshot";
import { createZoneEditRenderSnapshot } from "../../../rendering/zoneEditRenderSnapshot";
import { saveEditorContent } from "../editorSaveClient";
import { draftHasBlockingErrors, type SaveStatus } from "../editorModel";
import type { CombinedDraftView, DraftSlot } from "../editorDraftTypes";
import {
  cloneZoneData,
  listEditorZones,
  serializeZoneData,
  zoneContentPath,
  type EditorZoneListEntry,
} from "./zoneEditorModel";

/** Undo/redo history for one zone's draft, kept per zone id in the owner. */
export interface ZoneHistory {
  past: ZoneData[];
  present: ZoneData;
  future: ZoneData[];
}

export interface ZoneDraftSlot {
  selectedZoneId: string;
  setSelectedZoneId: (zoneId: string) => void;
  pinnedInspectCell: GridCell | null;
  setPinnedInspectCell: (cell: GridCell | null) => void;
  histories: DraftSlot<Record<string, ZoneHistory>>;
  savedJson: DraftSlot<Record<string, string>>;
}

/**
 * The current present draft of every zone that has been opened for editing.
 *
 * Fed into the combined snapshot so cross-tab validation sees painted tiles.
 */
export function activeZoneDrafts(
  histories: Record<string, ZoneHistory>,
): ZoneData[] {
  return Object.values(histories).map((history) => history.present);
}

export interface ZoneDraftController {
  zones: EditorZoneListEntry[];
  selectedZoneId: string;
  selectZone: (zoneId: string) => void;
  pinnedInspectCell: GridCell | null;
  setPinnedInspectCell: (cell: GridCell | null) => void;
  draft: ZoneData | null;
  renderSnapshot: GridRenderSnapshot | null;
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

export function useZoneDraft(
  base: ContentCatalogSnapshot,
  slot: ZoneDraftSlot,
  combined: CombinedDraftView,
): ZoneDraftController {
  const {
    selectedZoneId,
    setSelectedZoneId,
    pinnedInspectCell,
    setPinnedInspectCell,
  } = slot;
  const histories = slot.histories.value;
  const setHistories = slot.histories.set;
  const savedJsonMap = slot.savedJson.value;
  const setSavedJsonMap = slot.savedJson.set;

  const [saveStatus, setSaveStatus] = useState<SaveStatus>({
    state: "idle",
    message: "",
  });

  const zones = useMemo(() => listEditorZones(base), [base]);
  const baseZone: ZoneData | undefined = base.zones[selectedZoneId];
  const history = histories[selectedZoneId];
  const draft = history?.present ?? baseZone ?? null;

  const savedJson =
    savedJsonMap[selectedZoneId] ??
    (baseZone ? serializeZoneData(baseZone) : "");
  const serialized = useMemo(
    () => (draft ? serializeZoneData(draft) : ""),
    [draft],
  );
  const renderSnapshot = useMemo(
    () => (draft ? createZoneEditRenderSnapshot(draft) : null),
    [draft],
  );

  const hasUnsavedChanges = draft !== null && serialized !== savedJson;
  const isSaving = saveStatus.state === "saving";
  const canSave = hasUnsavedChanges && combined.errorCount === 0 && !isSaving;
  const canUndo = (history?.past.length ?? 0) > 0;
  const canRedo = (history?.future.length ?? 0) > 0;

  const displayStatus: SaveStatus =
    saveStatus.state === "idle"
      ? {
          state: "idle",
          message: hasUnsavedChanges ? "Unsaved changes." : "No changes.",
        }
      : saveStatus;

  function markEditing(): void {
    setSaveStatus((prev) =>
      prev.state === "idle" ? prev : { state: "idle", message: "" },
    );
  }

  /** Returns the current history for the selected zone, initializing it lazily. */
  function currentHistory(
    map: Record<string, ZoneHistory>,
  ): ZoneHistory | null {
    const existing = map[selectedZoneId];
    if (existing) {
      return existing;
    }
    if (!baseZone) {
      return null;
    }
    return { past: [], present: cloneZoneData(baseZone), future: [] };
  }

  function updateDraft(updater: (zone: ZoneData) => ZoneData): void {
    setHistories((map) => {
      const current = currentHistory(map);
      if (!current) {
        return map;
      }
      const next = updater(current.present);
      if (next === current.present) {
        return map;
      }
      return {
        ...map,
        [selectedZoneId]: {
          past: [...current.past, current.present],
          present: next,
          future: [],
        },
      };
    });
    markEditing();
  }

  function undo(): void {
    setHistories((map) => {
      const current = map[selectedZoneId];
      if (!current || current.past.length === 0) {
        return map;
      }
      return {
        ...map,
        [selectedZoneId]: {
          past: current.past.slice(0, -1),
          present: current.past[current.past.length - 1],
          future: [current.present, ...current.future],
        },
      };
    });
    markEditing();
  }

  function redo(): void {
    setHistories((map) => {
      const current = map[selectedZoneId];
      if (!current || current.future.length === 0) {
        return map;
      }
      return {
        ...map,
        [selectedZoneId]: {
          past: [...current.past, current.present],
          present: current.future[0],
          future: current.future.slice(1),
        },
      };
    });
    markEditing();
  }

  function resetDraft(): void {
    if (!baseZone) {
      return;
    }
    // Reset is undoable: the current draft is pushed onto the history first.
    setHistories((map) => {
      const current = currentHistory(map);
      if (!current) {
        return map;
      }
      return {
        ...map,
        [selectedZoneId]: {
          past: [...current.past, current.present],
          present: cloneZoneData(baseZone),
          future: [],
        },
      };
    });
    setSavedJsonMap((map) => ({
      ...map,
      [selectedZoneId]: serializeZoneData(baseZone),
    }));
    setSaveStatus({ state: "idle", message: "" });
  }

  async function saveDraft(): Promise<void> {
    if (!draft || !hasUnsavedChanges) {
      setSaveStatus({ state: "idle", message: "" });
      return;
    }

    if (draftHasBlockingErrors(combined.snapshot, combined.context)) {
      setSaveStatus({
        state: "error",
        message: "Resolve errors before saving.",
      });
      return;
    }

    const content = serialized;
    setSaveStatus({ state: "saving", message: "Saving..." });
    const result = await saveEditorContent(
      zoneContentPath(draft.zoneId),
      content,
    );
    if (!result.ok) {
      setSaveStatus({ state: "error", message: result.error });
      return;
    }

    setSavedJsonMap((map) => ({ ...map, [selectedZoneId]: content }));
    setSaveStatus({ state: "saved", message: `Saved ${result.path}.` });
  }

  return {
    zones,
    selectedZoneId,
    selectZone: setSelectedZoneId,
    pinnedInspectCell,
    setPinnedInspectCell,
    draft,
    renderSnapshot,
    diagnostics: combined.diagnostics,
    errorCount: combined.errorCount,
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
