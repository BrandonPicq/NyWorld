import { formatContentDiagnostic } from "../../engine";
import { ScrollRegion } from "../components/ScrollRegion";
import { TerminalButton } from "../components/TerminalButton";
import { TerminalPanel } from "../components/TerminalPanel";
import type { GameConfigController } from "./useGameConfigDraft";

type GameConfigPanelProps = {
  draft: GameConfigController;
};

/**
 * "Game" tab: pick the default zone and the safe respawn point in game.json.
 *
 * Only defaultZoneId and safeRespawn are editable here; the rest of the config
 * is preserved and the file is re-serialized with its inline inventory intact.
 */
export function GameConfigPanel({ draft }: GameConfigPanelProps) {
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

  return (
    <div className="workbench workbench--game-layout">
      <ScrollRegion className="workbench__main">
        <TerminalPanel className="editor-panel">
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
                    setRespawn({ x: intOr(event.target.value, config.safeRespawn.x) })
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
                    setRespawn({ y: intOr(event.target.value, config.safeRespawn.y) })
                  }
                  step={1}
                  type="number"
                  value={config.safeRespawn.y}
                />
              </label>
            </div>

            <div className="editor-actions">
              <TerminalButton
                className="editor-action-button"
                disabled={!canSave}
                onClick={save}
              >
                Save Config
              </TerminalButton>
              <TerminalButton
                className="editor-action-button"
                disabled={!hasUnsavedChanges || isSaving}
                onClick={reset}
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
          </section>
        </TerminalPanel>
      </ScrollRegion>

      <ScrollRegion className="workbench__inspector">
        <TerminalPanel className="editor-panel">
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
        </TerminalPanel>
      </ScrollRegion>
    </div>
  );
}

function intOr(value: string, fallback: number): number {
  const parsed = Math.round(Number(value));
  return Number.isFinite(parsed) ? parsed : fallback;
}
