import { useMemo, useState } from "react";
import {
  createRuntimeContentValidationContext,
  getAllTileDefs,
  validateAllContent,
  type ContentCatalogSnapshot,
  type ContentDiagnostic,
  type TileDef,
  type ZoneData,
} from "../../../engine";
import type { GridCell } from "../../../rendering/canvasCellMapping";
import type { GridRenderSnapshot } from "../../../rendering/renderSnapshot";
import { createZoneEditRenderSnapshot } from "../../../rendering/zoneEditRenderSnapshot";
import { saveEditorContent } from "../editorSaveClient";
import type { SaveStatus } from "../editorModel";
import {
  cloneZoneData,
  createZoneDraftSnapshot,
  createZoneDraftValidationContext,
  serializeZoneData,
  setTileAt,
  zoneContentPath,
} from "./zoneEditorModel";

export interface ZonePaletteTile {
  id: number;
  def: TileDef;
}

/**
 * Tile-painting draft state for one zone.
 *
 * Callers mount this behind a `key={zoneId}` so switching zones remounts with a
 * fresh draft (unsaved tile edits are discarded on switch — a noted follow-up).
 */
export interface ZoneDraftController {
  renderSnapshot: GridRenderSnapshot;
  draft: ZoneData;
  diagnostics: ContentDiagnostic[];
  errorCount: number;
  tiles: ZonePaletteTile[];
  activeTileId: number;
  setActiveTileId: (id: number) => void;
  paintCell: (cell: GridCell) => void;
  hasUnsavedChanges: boolean;
  canSave: boolean;
  isSaving: boolean;
  saveStatus: SaveStatus;
  resetDraft: () => void;
  saveDraft: () => Promise<void>;
}

export function useZoneDraft(
  zone: ZoneData,
  snapshot: ContentCatalogSnapshot,
): ZoneDraftController {
  const context = useMemo(() => createRuntimeContentValidationContext(), []);
  const tiles = useMemo<ZonePaletteTile[]>(
    () =>
      [...getAllTileDefs().entries()]
        .sort(([a], [b]) => a - b)
        .map(([id, def]) => ({ id, def })),
    [],
  );

  const [draft, setDraft] = useState<ZoneData>(() => cloneZoneData(zone));
  const [savedJson, setSavedJson] = useState(() => serializeZoneData(zone));
  const [saveStatus, setSaveStatus] = useState<SaveStatus>({
    state: "idle",
    message: "",
  });
  const [activeTileId, setActiveTileId] = useState<number>(
    () => tiles[0]?.id ?? 0,
  );

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

  const displayStatus: SaveStatus =
    saveStatus.state === "idle"
      ? {
          state: "idle",
          message: hasUnsavedChanges ? "Unsaved changes." : "No changes.",
        }
      : saveStatus;

  function paintCell(cell: GridCell): void {
    setDraft((prev) => setTileAt(prev, cell.x, cell.y, activeTileId));
    // Clear a lingering "saved"/"error" message once painting resumes; the
    // functional update bails out (same reference) while already idle, so a
    // drag does not churn state after the first cell.
    setSaveStatus((prev) =>
      prev.state === "idle" ? prev : { state: "idle", message: "" },
    );
  }

  function resetDraft(): void {
    setDraft(cloneZoneData(zone));
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
    const result = await saveEditorContent(zoneContentPath(zone.zoneId), content);
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
    tiles,
    activeTileId,
    setActiveTileId,
    paintCell,
    hasUnsavedChanges,
    canSave,
    isSaving,
    saveStatus: displayStatus,
    resetDraft,
    saveDraft,
  };
}
