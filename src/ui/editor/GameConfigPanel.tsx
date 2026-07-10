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
  const [isLocationPickerOpen, setLocationPickerOpen] = useState(false);
  const [locationTarget, setLocationTarget] = useState<"start" | "respawn">("start");
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
    setStartPosition,
    setRespawn,
    reset,
    save,
  } = draft;
  const startPosition = config.newGame.startPosition ??
    snapshot.zones[config.defaultZoneId]?.playerStart;
  const pickerTargets = [
    { id: "start", label: "Game start", zoneId: config.defaultZoneId },
    { id: "respawn", label: "Safe respawn", zoneId: config.safeRespawn.zoneId },
  ] as const;
  const activePickerTarget = pickerTargets.find((target) => target.id === locationTarget)!;
  const canPickLocation = !isSaving && !!snapshot.zones[activePickerTarget.zoneId];

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

              <p className="editor-placement-hint">
                Game start: ({startPosition?.x ?? "-"}, {startPosition?.y ?? "-"})
              </p>

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

              <p className="editor-placement-hint">
                Safe respawn: ({config.safeRespawn.x}, {config.safeRespawn.y})
              </p>
              <EditorButton
                className="editor-compact-button"
                disabled={!canPickLocation}
                onClick={() => setLocationPickerOpen(true)}
              >
                Pick Location
              </EditorButton>

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

      {isLocationPickerOpen ? (
        <MapCoordinatePicker
          onClose={() => setLocationPickerOpen(false)}
          onPick={(cell) => {
            if (locationTarget === "start") {
              setStartPosition(cell);
            } else {
              setRespawn({ x: cell.x, y: cell.y });
            }
          }}
          onTargetChange={(targetId) => {
            if (targetId === "start" || targetId === "respawn") {
              setLocationTarget(targetId);
            }
          }}
          snapshot={snapshot}
          targetId={locationTarget}
          targets={pickerTargets}
          title="Pick location"
          zoneId={activePickerTarget.zoneId}
        />
      ) : null}
    </>
  );
}
