import { useMemo, useState } from "react";
import {
  validateGameConfig,
  type ContentCatalogSnapshot,
  type ContentDiagnostic,
  type GameContentConfig,
} from "../../engine";
import { GAME_CONFIG_CONTENT_PATH, saveEditorContent } from "./editorSaveClient";
import {
  formatFileSaveBlocker,
  getFileSaveGate,
  getFileSaveStatus,
  serializeGameConfig,
  type SaveStatus,
} from "./editorModel";
import type { CombinedDraftView, DraftSlot } from "./editorDraftTypes";

export interface GameConfigDraftSlot {
  draft: DraftSlot<GameContentConfig>;
  savedJson: DraftSlot<string>;
}

export function createGameConfigDraftState(
  base: ContentCatalogSnapshot,
): GameContentConfig {
  return base.game;
}

export interface GameConfigController {
  draft: GameContentConfig;
  zoneIds: string[];
  diagnostics: ContentDiagnostic[];
  errorCount: number;
  warningCount: number;
  hasUnsavedChanges: boolean;
  canSave: boolean;
  isSaving: boolean;
  saveStatus: SaveStatus;
  setDefaultZone: (zoneId: string) => void;
  setRespawn: (patch: Partial<GameContentConfig["safeRespawn"]>) => void;
  reset: () => void;
  save: () => Promise<void>;
}

export function useGameConfigDraft(
  base: ContentCatalogSnapshot,
  slot: GameConfigDraftSlot,
  combined: CombinedDraftView,
): GameConfigController {
  const draft = slot.draft.value;
  const setDraft = slot.draft.set;
  const savedJson = slot.savedJson.value;
  const setSavedJson = slot.savedJson.set;

  const [saveStatus, setSaveStatus] = useState<SaveStatus>({
    state: "idle",
    message: "",
  });

  const zoneIds = useMemo(
    () => Object.keys(base.zones).sort((a, b) => a.localeCompare(b)),
    [base.zones],
  );
  const serialized = useMemo(() => serializeGameConfig(draft), [draft]);
  const hasUnsavedChanges = serialized !== savedJson;
  const isSaving = saveStatus.state === "saving";
  const gameSaveGate = getFileSaveGate(
    validateGameConfig(draft, combined.context),
    { hasUnsavedChanges, isSaving },
  );
  const canSave = gameSaveGate.canSave;
  const displayStatus = getFileSaveStatus(saveStatus, {
    hasUnsavedChanges,
    errorCount: gameSaveGate.errorCount,
  });

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
    setDraft(base.game);
    setSavedJson(serializeGameConfig(base.game));
    setSaveStatus({ state: "idle", message: "" });
  }

  async function save(): Promise<void> {
    if (!hasUnsavedChanges || isSaving) {
      return;
    }
    const saveGate = getFileSaveGate(
      validateGameConfig(draft, combined.context),
      { hasUnsavedChanges, isSaving },
    );
    if (saveGate.errorCount > 0) {
      setSaveStatus({
        state: "error",
        message: formatFileSaveBlocker(saveGate.errorCount),
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

  return {
    draft,
    zoneIds,
    diagnostics: combined.diagnostics,
    errorCount: combined.errorCount,
    warningCount: combined.warningCount,
    hasUnsavedChanges,
    canSave,
    isSaving,
    saveStatus: displayStatus,
    setDefaultZone,
    setRespawn,
    reset,
    save,
  };
}
