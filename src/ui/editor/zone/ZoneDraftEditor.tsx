import { useEffect, useState } from "react";
import {
  formatContentDiagnostic,
  type ContentCatalogSnapshot,
} from "../../../engine";
import type { GridCell } from "../../../rendering/canvasCellMapping";
import { ScrollRegion } from "../../components/ScrollRegion";
import { TerminalButton } from "../../components/TerminalButton";
import { TerminalPanel } from "../../components/TerminalPanel";
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

  return (
    <>
      <TerminalPanel className="editor-panel editor-zone-preview">
        <div className="editor-zone-workbench-header">
          <h2 className="editor-panel__title">Edit</h2>
          <p className="editor-zone-dimensions">
            {draft.width} × {draft.height} tiles · start ({draft.playerStart.x},{" "}
            {draft.playerStart.y})
          </p>
        </div>
        <div className="editor-zone-workbench">
          <div className="editor-zone-map-area">
            <ScrollRegion className="editor-zone-canvas-frame">
              <EditorZoneCanvas
                ariaLabel={`Zone ${draft.name} edit surface`}
                cellSize={48}
                onCellPointer={handleCell}
                onCellHover={handleHover}
                renderSnapshot={renderSnapshot}
              />
            </ScrollRegion>
          </div>
          <aside className="editor-zone-toolbox" aria-label="Zone edit tools">
            <div className="editor-zone-controls-wrapper">
              <ZonePlacementControls placement={placement} />
              {cellDescription && (
                <div className="editor-zone-readout" data-testid="zone-cell-readout">
                  <h3 className="editor-zone-toolbox__title">Cell Info</h3>
                  <div className="editor-readout-details">
                    <div className="editor-readout-coords">
                      ({cellDescription.x}, {cellDescription.y})
                    </div>
                    <div className="editor-readout-tile">
                      Tile: <span className="editor-readout-glyph">{cellDescription.tileGlyph}</span> {cellDescription.tileName}
                    </div>
                    <div className="editor-readout-walkable">
                      <span
                        className={`editor-tile-swatch__badge editor-tile-swatch__badge--${
                          cellDescription.walkable ? "walkable" : "blocked"
                        }`}
                      >
                        {cellDescription.walkable ? "walkable" : "blocked"}
                      </span>
                    </div>
                    {cellDescription.whatSitsThere && (
                      <div className="editor-readout-contents">
                        {cellDescription.whatSitsThere}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
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
          </aside>
        </div>
      </TerminalPanel>

      <TerminalPanel className="editor-panel editor-zone-details">
        <h2 className="editor-panel__title">Contents</h2>
        <ScrollRegion className="editor-scroll">
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
            onUpdate={updateDraft}
            zone={draft}
            zoneIds={placement.zoneIds}
          />
          <EntryDialogueEditor onUpdate={updateDraft} zone={draft} />
        </ScrollRegion>
      </TerminalPanel>
    </>
  );
}
