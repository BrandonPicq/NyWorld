import { useState } from "react";
import type { ContentCatalogSnapshot } from "../../engine";
import { ScrollRegion } from "../components/ScrollRegion";
import { EditorButton } from "./components/EditorButton";
import { EditorPanel } from "./components/EditorPanel";
import {
  DiagnosticList,
  type EditorContentNavigationTarget,
} from "./DiagnosticList";
import { MapCoordinatePicker } from "./MapCoordinatePicker";
import type { GameConfigController } from "./useGameConfigDraft";

type GameConfigPanelProps = {
  draft: GameConfigController;
  onNavigate: (target: EditorContentNavigationTarget) => void;
  snapshot: ContentCatalogSnapshot;
};

/**
 * "Game" tab: pick the default zone and the safe respawn point in game.json.
 *
 * Only defaultZoneId and safeRespawn are editable here; the rest of the config
 * is preserved and the file is re-serialized with its inline inventory intact.
 */
export function GameConfigPanel({
  draft,
  onNavigate,
  snapshot,
}: GameConfigPanelProps) {
  const [isRespawnPickerOpen, setRespawnPickerOpen] = useState(false);
  const {
    draft: config,
    zoneIds,
    diagnostics,
    errorCount,
    warningCount,
    hasUnsavedChanges,
    canSave,
    isSaving,
    saveStatus,
    setDefaultZone,
    setRespawn,
    reset,
    save,
  } = draft;
  const canPickRespawn =
    !isSaving && !!snapshot.zones[config.safeRespawn.zoneId];

  return (
    <>
      <div className="workbench workbench--game-layout">
        <ScrollRegion className="workbench__main">
          <EditorPanel className="editor-panel">
            <h2 className="editor-panel__title">Game Config</h2>
            <section className="editor-item-form">
              <label className="editor-field">
                <span>Default Zone</span>
                <select
                  disabled={isSaving}
                  onChange={(event) => setDefaultZone(event.target.value)}
                  value={config.defaultZoneId}
                >
                  {zoneIds.map((zoneId) => (
                    <option key={zoneId} value={zoneId}>
                      {zoneId}
                    </option>
                  ))}
                </select>
              </label>

              <label className="editor-field">
                <span>Safe Respawn Zone</span>
                <select
                  disabled={isSaving}
                  onChange={(event) => setRespawn({ zoneId: event.target.value })}
                  value={config.safeRespawn.zoneId}
                >
                  {zoneIds.map((zoneId) => (
                    <option key={zoneId} value={zoneId}>
                      {zoneId}
                    </option>
                  ))}
                </select>
              </label>

              <div className="editor-form-row">
                <label className="editor-field">
                  <span>Respawn X</span>
                  <input
                    disabled={isSaving}
                    min={0}
                    onChange={(event) =>
                      setRespawn({
                        x: intOr(event.target.value, config.safeRespawn.x),
                      })
                    }
                    step={1}
                    type="number"
                    value={config.safeRespawn.x}
                  />
                </label>
                <label className="editor-field">
                  <span>Respawn Y</span>
                  <input
                    disabled={isSaving}
                    min={0}
                    onChange={(event) =>
                      setRespawn({
                        y: intOr(event.target.value, config.safeRespawn.y),
                      })
                    }
                    step={1}
                    type="number"
                    value={config.safeRespawn.y}
                  />
                </label>
                <EditorButton
                  className="editor-compact-button"
                  disabled={!canPickRespawn}
                  onClick={() => setRespawnPickerOpen(true)}
                >
                  Pick on Map
                </EditorButton>
              </div>

              <div className="editor-actions">
                <EditorButton
                  className="editor-action-button"
                  disabled={!canSave}
                  onClick={save}
                >
                  Save Config
                </EditorButton>
                <EditorButton
                  className="editor-action-button"
                  disabled={!hasUnsavedChanges || isSaving}
                  onClick={reset}
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
            </section>
          </EditorPanel>
        </ScrollRegion>

        <ScrollRegion className="workbench__inspector">
          <EditorPanel className="editor-panel">
            <h2 className="editor-panel__title">Problems</h2>
            <section className="editor-zone-section">
              <div className="editor-family__header">
                <h3>Diagnostics</h3>
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
          </EditorPanel>
        </ScrollRegion>
      </div>

      {isRespawnPickerOpen ? (
        <MapCoordinatePicker
          onClose={() => setRespawnPickerOpen(false)}
          onPick={(cell) => setRespawn({ x: cell.x, y: cell.y })}
          snapshot={snapshot}
          title="Pick safe respawn"
          zoneId={config.safeRespawn.zoneId}
        />
      ) : null}
    </>
  );
}

function intOr(value: string, fallback: number): number {
  const parsed = Math.round(Number(value));
  return Number.isFinite(parsed) ? parsed : fallback;
}
