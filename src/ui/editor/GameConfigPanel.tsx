import { useDeferredValue, useMemo, useState } from "react";
import {
  createRuntimeContentValidationContext,
  formatContentDiagnostic,
  validateAllContent,
  type ContentCatalogSnapshot,
  type GameContentConfig,
} from "../../engine";
import { ScrollRegion } from "../components/ScrollRegion";
import { TerminalButton } from "../components/TerminalButton";
import { TerminalPanel } from "../components/TerminalPanel";
import { GAME_CONFIG_CONTENT_PATH, saveEditorContent } from "./editorSaveClient";
import {
  draftHasBlockingErrors,
  serializeGameConfig,
  type SaveStatus,
} from "./editorModel";

type GameConfigPanelProps = {
  snapshot: ContentCatalogSnapshot;
};

/**
 * "Game" tab: pick the default zone and the safe respawn point in game.json.
 *
 * Only defaultZoneId and safeRespawn are editable here; the rest of the config
 * is preserved and the file is re-serialized with its inline inventory intact.
 */
export function GameConfigPanel({ snapshot }: GameConfigPanelProps) {
  const context = useMemo(() => createRuntimeContentValidationContext(), []);
  const zoneIds = useMemo(
    () => Object.keys(snapshot.zones).sort((a, b) => a.localeCompare(b)),
    [snapshot],
  );

  const [draft, setDraft] = useState<GameContentConfig>(snapshot.game);
  const [savedJson, setSavedJson] = useState(() =>
    serializeGameConfig(snapshot.game),
  );
  const [saveStatus, setSaveStatus] = useState<SaveStatus>({
    state: "idle",
    message: "",
  });

  // Defer whole-bundle validation off the typing path; save stays live.
  const deferredDraft = useDeferredValue(draft);
  const diagnostics = useMemo(
    () => validateAllContent({ ...snapshot, game: deferredDraft }, context),
    [snapshot, deferredDraft, context],
  );
  const errorCount = diagnostics.filter(
    (diagnostic) => diagnostic.severity === "error",
  ).length;
  const warningCount = diagnostics.length - errorCount;
  const serialized = useMemo(() => serializeGameConfig(draft), [draft]);
  const hasUnsavedChanges = serialized !== savedJson;
  const isSaving = saveStatus.state === "saving";
  const canSave = hasUnsavedChanges && errorCount === 0 && !isSaving;

  const statusMessage =
    saveStatus.state === "idle"
      ? hasUnsavedChanges
        ? "Unsaved changes."
        : "No changes."
      : saveStatus.message;

  function setDefaultZone(zoneId: string): void {
    setDraft((current) => ({ ...current, defaultZoneId: zoneId }));
    setSaveStatus({ state: "idle", message: "" });
  }

  function setRespawn(patch: Partial<GameContentConfig["safeRespawn"]>): void {
    setDraft((current) => ({
      ...current,
      safeRespawn: { ...current.safeRespawn, ...patch },
    }));
    setSaveStatus({ state: "idle", message: "" });
  }

  function reset(): void {
    setDraft(snapshot.game);
    setSavedJson(serializeGameConfig(snapshot.game));
    setSaveStatus({ state: "idle", message: "" });
  }

  async function save(): Promise<void> {
    if (!hasUnsavedChanges || isSaving) {
      return;
    }
    // Re-validate the live draft: canSave/errorCount may lag behind typing.
    if (draftHasBlockingErrors({ ...snapshot, game: draft }, context)) {
      setSaveStatus({
        state: "error",
        message: "Resolve errors before saving.",
      });
      return;
    }
    setSaveStatus({ state: "saving", message: "Saving..." });
    const result = await saveEditorContent(GAME_CONFIG_CONTENT_PATH, serialized);
    if (!result.ok) {
      setSaveStatus({ state: "error", message: result.error });
      return;
    }
    setSavedJson(serialized);
    setSaveStatus({ state: "saved", message: `Saved ${result.path}.` });
  }

  return (
    <div className="editor-game-layout">
      <TerminalPanel className="editor-panel">
        <h2 className="editor-panel__title">Game Config</h2>
        <ScrollRegion className="editor-scroll">
          <section className="editor-item-form">
            <label className="editor-field">
              <span>Default Zone</span>
              <select
                disabled={isSaving}
                onChange={(event) => setDefaultZone(event.target.value)}
                value={draft.defaultZoneId}
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
                value={draft.safeRespawn.zoneId}
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
                    setRespawn({ x: intOr(event.target.value, draft.safeRespawn.x) })
                  }
                  step={1}
                  type="number"
                  value={draft.safeRespawn.x}
                />
              </label>
              <label className="editor-field">
                <span>Respawn Y</span>
                <input
                  disabled={isSaving}
                  min={0}
                  onChange={(event) =>
                    setRespawn({ y: intOr(event.target.value, draft.safeRespawn.y) })
                  }
                  step={1}
                  type="number"
                  value={draft.safeRespawn.y}
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
              {statusMessage}
            </p>
          </section>

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
        </ScrollRegion>
      </TerminalPanel>
    </div>
  );
}

function intOr(value: string, fallback: number): number {
  const parsed = Math.round(Number(value));
  return Number.isFinite(parsed) ? parsed : fallback;
}
