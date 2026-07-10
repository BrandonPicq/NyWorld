import { useEffect, useState } from "react";
import type { ContentCatalogSnapshot } from "../../../engine";
import type { GridCell } from "../../../rendering/canvasCellMapping";
import { createZoneEditRenderSnapshot } from "../../../rendering/zoneEditRenderSnapshot";
import { ScrollRegion } from "../../components/ScrollRegion";
import { EditorButton } from "../components/EditorButton";
import { EditorPanel } from "../components/EditorPanel";
import {
  DiagnosticList,
  type EditorContentNavigationTarget,
} from "../DiagnosticList";
import { MapCoordinatePicker } from "../MapCoordinatePicker";
import { EditorZoneCanvas } from "./EditorZoneCanvas";
import { ZoneContents } from "./ZoneContents";
import { ZonePlacementControls } from "./ZonePlacementControls";
import { usePlacementSelection } from "./usePlacementSelection";
import type { ZoneDraftController } from "./useZoneDraft";
import { describeZoneCell, findPlacementAt } from "./zoneEditorModel";

type ZoneDraftEditorProps = {
  controller: ZoneDraftController;
  onNavigate: (target: EditorContentNavigationTarget) => void;
  snapshot: ContentCatalogSnapshot;
};

type CoordinatePickerRequest = {
  title: string;
  zoneId: string;
  onPick: (cell: GridCell) => void;
};

/**
 * Zone editor for the selected zone: a placement mode selector + paintable
 * canvas + live whole-bundle validation + save. Selection and undo history are
 * owned by the shared editor draft owner.
 */
export function ZoneDraftEditor({
  controller,
  onNavigate,
  snapshot,
}: ZoneDraftEditorProps) {
  const {
    renderSnapshot,
    draft,
    diagnostics,
    errorCount,
    updateDraft,
    hasUnsavedChanges,
    canSave,
    isSaving,
    saveStatus,
    canUndo,
    canRedo,
    undo,
    redo,
    resetDraft,
    saveDraft,
    pinnedInspectCell,
    setPinnedInspectCell,
  } = controller;
  const placement = usePlacementSelection(snapshot);

  const [hoveredCell, setHoveredCell] = useState<GridCell | null>(null);
  const [coordinatePicker, setCoordinatePicker] =
    useState<CoordinatePickerRequest | null>(null);
  const [isSchedulePreviewEnabled, setSchedulePreviewEnabled] =
    useState(false);
  const [previewMinutes, setPreviewMinutes] = useState(8 * 60);

  useEffect(() => {
    setHoveredCell(null);
    setPinnedInspectCell(null);
  }, [draft?.zoneId, placement.mode, setPinnedInspectCell]);

  if (!draft || !renderSnapshot) {
    return null;
  }

  const warningCount = diagnostics.length - errorCount;
  const activeRenderSnapshot = isSchedulePreviewEnabled
    ? createZoneEditRenderSnapshot(draft, {
        minutesOfDay: previewMinutes,
        presence: snapshot.npcPresence,
      })
    : renderSnapshot;

  const activeReadoutCell = hoveredCell || pinnedInspectCell;
  const cellDescription = activeReadoutCell ? describeZoneCell(draft, activeReadoutCell) : null;

  // In inspect mode, the pinned cell selects the placement sitting there so the
  // inspector can focus and delete it. Preview mode stays inspect-only readout.
  const selectedPlacement =
    !isSchedulePreviewEnabled && placement.mode === "inspect" && pinnedInspectCell
      ? findPlacementAt(draft, pinnedInspectCell)
      : null;

  function handleCell(cell: GridCell, kind: "down" | "move"): void {
    if (isSchedulePreviewEnabled || placement.mode === "inspect") {
      if (kind === "down") {
        setPinnedInspectCell(cell);
      }
      return;
    }
    if (kind === "move" && !placement.paintsOnDrag) {
      return;
    }
    const edit = placement.buildEdit(cell);
    if (edit) {
      updateDraft(edit);
    }
  }

  function handleHover(cell: GridCell | null): void {
    setHoveredCell(cell);
  }

  function openTransitionTargetPicker(): void {
    if (!snapshot.zones[placement.targetZoneId]) {
      return;
    }
    setCoordinatePicker({
      title: `Pick transition target in ${placement.targetZoneId}`,
      zoneId: placement.targetZoneId,
      onPick: (cell) => {
        placement.setTargetX(cell.x);
        placement.setTargetY(cell.y);
      },
    });
  }

  return (
    <>
      <ScrollRegion className="workbench__main">
        <EditorPanel className="editor-panel editor-zone-edit-panel">
          <div className="editor-zone-workbench-header">
            <h2 className="editor-panel__title">Edit</h2>
            <p className="editor-zone-dimensions">
              {draft.width} × {draft.height} tiles · start ({draft.playerStart.x},{" "}
              {draft.playerStart.y})
            </p>
            <label className="editor-field">
              <span>Fog of War</span>
              <input
                checked={draft.fogOfWar ?? false}
                onChange={(event) =>
                  updateDraft((zone) => ({
                    ...zone,
                    fogOfWar: event.target.checked,
                  }))
                }
                type="checkbox"
              />
            </label>
          </div>
          <div className="editor-zone-canvas-frame">
            <EditorZoneCanvas
              ariaLabel={`Zone ${draft.name} edit surface`}
              cellSize={48}
              onCellPointer={handleCell}
              onCellHover={handleHover}
              renderSnapshot={activeRenderSnapshot}
            />
          </div>

          <div className="workbench__statusbar" data-testid="zone-cell-readout">
            <span className="workbench__statusbar-coords">
              {cellDescription ? `(${cellDescription.x}, ${cellDescription.y})` : "(—, —)"}
            </span>
            <span className="workbench__statusbar-sep">·</span>
            <span className="workbench__statusbar-tile">
              {cellDescription ? (
                <>
                  Tile: <span className="workbench__statusbar-glyph">{cellDescription.tileGlyph}</span> {cellDescription.tileName}
                </>
              ) : (
                "—"
              )}
            </span>
            <span className="workbench__statusbar-sep">·</span>
            <span className="workbench__statusbar-walkable">
              {cellDescription ? (
                <span
                  className={`workbench__statusbar-badge workbench__statusbar-badge--${
                    cellDescription.walkable ? "walkable" : "blocked"
                  }`}
                >
                  {cellDescription.walkable ? "walkable" : "blocked"}
                </span>
              ) : (
                "—"
              )}
            </span>
            {cellDescription && cellDescription.whatSitsThere && (
              <>
                <span className="workbench__statusbar-sep">·</span>
                <span className="workbench__statusbar-contents">
                  {cellDescription.whatSitsThere}
                </span>
              </>
            )}
          </div>
        </EditorPanel>
      </ScrollRegion>

      <ScrollRegion className="workbench__inspector">
        <EditorPanel className="editor-panel">
          <section className="editor-zone-section">
            <div className="editor-family__header">
              <h3>Schedule Preview</h3>
              <span>{formatClock(previewMinutes)}</span>
            </div>
            <label className="editor-checkbox-field">
              <input
                checked={isSchedulePreviewEnabled}
                onChange={(event) =>
                  setSchedulePreviewEnabled(event.target.checked)
                }
                type="checkbox"
              />
              <span>Preview NPC schedules</span>
            </label>
            <label className="editor-field">
              <span>Time of Day</span>
              <input
                disabled={!isSchedulePreviewEnabled}
                max={23 * 60 + 45}
                min={0}
                onChange={(event) =>
                  setPreviewMinutes(Number(event.target.value))
                }
                step={15}
                type="range"
                value={previewMinutes}
              />
            </label>
          </section>

          <ZonePlacementControls
            disabled={isSchedulePreviewEnabled}
            placement={placement}
            onPickTransitionTarget={openTransitionTargetPicker}
          />

          <div className="editor-zone-save">
            <h3 className="editor-zone-toolbox__title">Draft</h3>
            <div className="editor-actions">
              <EditorButton
                className="editor-action-button"
                disabled={!canUndo || isSaving}
                onClick={undo}
              >
                Undo
              </EditorButton>
              <EditorButton
                className="editor-action-button"
                disabled={!canRedo || isSaving}
                onClick={redo}
              >
                Redo
              </EditorButton>
            </div>
            <div className="editor-actions">
              <EditorButton
                className="editor-action-button"
                disabled={!canSave}
                onClick={saveDraft}
              >
                Save Zone
              </EditorButton>
              <EditorButton
                className="editor-action-button"
                disabled={!hasUnsavedChanges || isSaving}
                onClick={resetDraft}
              >
                Reset
              </EditorButton>
            </div>
            <p
              aria-live="polite"
              className={`editor-save-status editor-save-status--${saveStatus.state}`}
            >
              {saveStatus.message}
            </p>
          </div>

          <section className="editor-zone-section">
            <div className="editor-family__header">
              <h3>Problems</h3>
              <span>
                {errorCount}E / {warningCount}W
              </span>
            </div>
            {diagnostics.length === 0 ? (
              <p className="editor-empty">No problems.</p>
            ) : (
              <DiagnosticList
                diagnostics={diagnostics}
                onNavigate={onNavigate}
              />
            )}
          </section>

          <ZoneContents
            dialogueIds={placement.dialogueIds}
            onPickScheduleCoordinate={setCoordinatePicker}
            onUpdate={updateDraft}
            selectedPlacement={selectedPlacement}
            zone={draft}
            zoneIds={placement.zoneIds}
          />
        </EditorPanel>
      </ScrollRegion>

      {coordinatePicker ? (
        <MapCoordinatePicker
          onClose={() => setCoordinatePicker(null)}
          onPick={coordinatePicker.onPick}
          snapshot={snapshot}
          title={coordinatePicker.title}
          zoneId={coordinatePicker.zoneId}
        />
      ) : null}
    </>
  );
}

function formatClock(minutesOfDay: number): string {
  const minutes = Math.max(0, Math.min(23 * 60 + 59, minutesOfDay));
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}
