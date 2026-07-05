import { formatContentDiagnostic, type ZoneData } from "../../../engine";
import { ScrollRegion } from "../../components/ScrollRegion";
import { TerminalButton } from "../../components/TerminalButton";
import { TerminalPanel } from "../../components/TerminalPanel";
import { EditorZoneCanvas } from "./EditorZoneCanvas";
import { ZoneContents } from "./ZoneContents";
import { ZoneTilePalette } from "./ZoneTilePalette";
import { useZoneDraft } from "./useZoneDraft";

type ZoneDraftEditorProps = {
  zone: ZoneData;
};

/**
 * Tile-painting editor for one zone: palette + paintable canvas + live
 * validation + save. Mount behind `key={zoneId}` so switching zones starts a
 * fresh draft.
 */
export function ZoneDraftEditor({ zone }: ZoneDraftEditorProps) {
  const {
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
    saveStatus,
    resetDraft,
    saveDraft,
  } = useZoneDraft(zone);

  const warningCount = diagnostics.length - errorCount;

  return (
    <>
      <TerminalPanel className="editor-panel editor-zone-preview">
        <h2 className="editor-panel__title">Paint</h2>
        <div className="editor-zone-preview__body">
          <ZoneTilePalette
            activeTileId={activeTileId}
            onSelect={setActiveTileId}
            tiles={tiles}
          />
          <ScrollRegion className="editor-zone-canvas-frame">
            <EditorZoneCanvas
              ariaLabel={`Zone ${draft.name} paint surface`}
              onCellPointer={(cell) => paintCell(cell)}
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
