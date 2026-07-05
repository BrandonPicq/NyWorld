import {
  formatContentDiagnostic,
  type ContentCatalogSnapshot,
  type ZoneData,
} from "../../../engine";
import type { GridCell } from "../../../rendering/canvasCellMapping";
import { ScrollRegion } from "../../components/ScrollRegion";
import { TerminalButton } from "../../components/TerminalButton";
import { TerminalPanel } from "../../components/TerminalPanel";
import { EditorZoneCanvas } from "./EditorZoneCanvas";
import { ZoneContents } from "./ZoneContents";
import { ZonePlacementControls } from "./ZonePlacementControls";
import { usePlacementSelection } from "./usePlacementSelection";
import { useZoneDraft } from "./useZoneDraft";

type ZoneDraftEditorProps = {
  zone: ZoneData;
  snapshot: ContentCatalogSnapshot;
};

/**
 * Zone editor for one zone: a placement mode selector + paintable canvas + live
 * validation + save. Mount behind `key={zoneId}` so switching zones starts a
 * fresh draft.
 */
export function ZoneDraftEditor({ zone, snapshot }: ZoneDraftEditorProps) {
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
    resetDraft,
    saveDraft,
  } = useZoneDraft(zone, snapshot);
  const placement = usePlacementSelection(snapshot);

  const warningCount = diagnostics.length - errorCount;

  function handleCell(cell: GridCell, kind: "down" | "move"): void {
    if (kind === "move" && !placement.paintsOnDrag) {
      return;
    }
    const edit = placement.buildEdit(cell);
    if (edit) {
      updateDraft(edit);
    }
  }

  return (
    <>
      <TerminalPanel className="editor-panel editor-zone-preview">
        <h2 className="editor-panel__title">Edit</h2>
        <div className="editor-zone-preview__body">
          <ZonePlacementControls placement={placement} />
          <ScrollRegion className="editor-zone-canvas-frame">
            <EditorZoneCanvas
              ariaLabel={`Zone ${draft.name} edit surface`}
              onCellPointer={handleCell}
              renderSnapshot={renderSnapshot}
            />
          </ScrollRegion>
          <div className="editor-zone-save">
            <p className="editor-zone-dimensions">
              {draft.width} × {draft.height} tiles · start (
              {draft.playerStart.x}, {draft.playerStart.y})
            </p>
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

          <ZoneContents zone={draft} />
        </ScrollRegion>
      </TerminalPanel>
    </>
  );
}
