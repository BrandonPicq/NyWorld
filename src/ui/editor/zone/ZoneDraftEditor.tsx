import { useEffect, useState } from "react";
import {
  formatContentDiagnostic,
  type ContentCatalogSnapshot,
} from "../../../engine";
import type { GridCell } from "../../../rendering/canvasCellMapping";
import { ScrollRegion } from "../../components/ScrollRegion";
import { TerminalButton } from "../../components/TerminalButton";
import { TerminalPanel } from "../../components/TerminalPanel";
import { MapCoordinatePicker } from "../MapCoordinatePicker";
import { EditorZoneCanvas } from "./EditorZoneCanvas";
import { EntryDialogueEditor } from "./EntryDialogueEditor";
import { ZoneContents } from "./ZoneContents";
import { ZonePlacementControls } from "./ZonePlacementControls";
import { usePlacementSelection } from "./usePlacementSelection";
import type { ZoneDraftController } from "./useZoneDraft";
import { describeZoneCell } from "./zoneEditorModel";

type ZoneDraftEditorProps = {
  controller: ZoneDraftController;
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
export function ZoneDraftEditor({ controller, snapshot }: ZoneDraftEditorProps) {
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
  } = controller;
  const placement = usePlacementSelection(snapshot);

  const [hoveredCell, setHoveredCell] = useState<GridCell | null>(null);
  const [pinnedCell, setPinnedCell] = useState<GridCell | null>(null);
  const [coordinatePicker, setCoordinatePicker] =
    useState<CoordinatePickerRequest | null>(null);

  useEffect(() => {
    setHoveredCell(null);
    setPinnedCell(null);
  }, [draft?.zoneId, placement.mode]);

  if (!draft || !renderSnapshot) {
    return null;
  }

  const warningCount = diagnostics.length - errorCount;

  const activeReadoutCell = hoveredCell || pinnedCell;
  const cellDescription = activeReadoutCell ? describeZoneCell(draft, activeReadoutCell) : null;

  function handleCell(cell: GridCell, kind: "down" | "move"): void {
    if (placement.mode === "inspect") {
      if (kind === "down") {
        setPinnedCell(cell);
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
        <TerminalPanel className="editor-panel editor-zone-edit-panel">
          <div className="editor-zone-workbench-header">
            <h2 className="editor-panel__title">Edit</h2>
            <p className="editor-zone-dimensions">
              {draft.width} × {draft.height} tiles · start ({draft.playerStart.x},{" "}
              {draft.playerStart.y})
            </p>
          </div>
          <div className="editor-zone-canvas-frame">
            <EditorZoneCanvas
              ariaLabel={`Zone ${draft.name} edit surface`}
              cellSize={48}
              onCellPointer={handleCell}
              onCellHover={handleHover}
              renderSnapshot={renderSnapshot}
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
        </TerminalPanel>
      </ScrollRegion>

      <ScrollRegion className="workbench__inspector">
        <TerminalPanel className="editor-panel">
          <ZonePlacementControls
            placement={placement}
            onPickTransitionTarget={openTransitionTargetPicker}
          />

          <div className="editor-zone-save">
            <h3 className="editor-zone-toolbox__title">Draft</h3>
            <div className="editor-actions">
              <TerminalButton
                className="editor-action-button"
                disabled={!canUndo || isSaving}
                onClick={undo}
              >
                Undo
              </TerminalButton>
              <TerminalButton
                className="editor-action-button"
                disabled={!canRedo || isSaving}
                onClick={redo}
              >
                Redo
              </TerminalButton>
            </div>
            <div className="editor-actions">
              <TerminalButton
                className="editor-action-button"
                disabled={!canSave}
                onClick={saveDraft}
              >
                Save Zone
              </TerminalButton>
              <TerminalButton
                className="editor-action-button"
                disabled={!hasUnsavedChanges || isSaving}
                onClick={resetDraft}
              >
                Reset
              </TerminalButton>
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
              <ul className="editor-diagnostic-list">
                {diagnostics.map((diagnostic, index) => (
                  <li
                    className={`editor-diagnostic editor-diagnostic--${diagnostic.severity}`}
                    key={`${diagnostic.path}-${index}`}
                  >
                    {formatContentDiagnostic(diagnostic)}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <ZoneContents
            dialogueIds={placement.dialogueIds}
            onPickScheduleCoordinate={setCoordinatePicker}
            onUpdate={updateDraft}
            zone={draft}
            zoneIds={placement.zoneIds}
          />
          <EntryDialogueEditor onUpdate={updateDraft} zone={draft} />
        </TerminalPanel>
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
