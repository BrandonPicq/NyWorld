import { useState } from "react";
import {
  CONTENT_TYPES,
  validateCombatActionDef,
  type CombatActionDef,
  type ContentCatalogSnapshot,
  type ContentDiagnostic,
} from "../../../engine";
import { saveEditorContent } from "../editorSaveClient";
import {
  formatFileSaveBlocker,
  getFileSaveGate,
  getFileSaveStatus,
  type SaveStatus,
} from "../editorModel";
import type { CombinedDraftView, DraftSlot } from "../editorDraftTypes";
import {
  actionContentPath,
  actionDerivedEffects,
  listAuthoredCombatActionDefs,
  serializeActionsById,
  serializeCombatActionDef,
  updateActionDef,
} from "./actionEditorModel";

export interface ActionDraftSlot {
  draft: DraftSlot<CombatActionDef[]>;
  saved: DraftSlot<CombatActionDef[]>;
}

export function createActionDraftState(
  base: ContentCatalogSnapshot,
): CombatActionDef[] {
  return listAuthoredCombatActionDefs(base);
}

export interface ActionListEntry {
  actionId: string;
  name: string;
  order: number;
  hasUnsavedChanges: boolean;
}

export interface ActionDraftController {
  actions: ActionListEntry[];
  selectedActionId: string;
  selectedAction: CombatActionDef | null;
  derivedEffects: string[];
  selectedActionDiagnostics: ContentDiagnostic[];
  errorCount: number;
  warningCount: number;
  hasUnsavedChanges: boolean;
  selectedActionHasUnsavedChanges: boolean;
  canSaveSelectedAction: boolean;
  canResetSelectedAction: boolean;
  isSaving: boolean;
  saveStatus: SaveStatus;
  selectAction: (actionId: string) => void;
  updateSelectedAction: (
    updater: (action: CombatActionDef) => CombatActionDef,
  ) => void;
  resetSelectedAction: () => void;
  saveSelectedAction: () => Promise<void>;
}

export function useActionDraft(
  slot: ActionDraftSlot,
  combined: CombinedDraftView,
): ActionDraftController {
  const draftActions = slot.draft.value;
  const setDraftActions = slot.draft.set;
  const savedActions = slot.saved.value;
  const setSavedActions = slot.saved.set;

  const [selectedActionId, setSelectedActionId] = useState<string>(
    () => draftActions[0]?.actionId ?? "",
  );
  const [saveStatus, setSaveStatus] = useState<SaveStatus>({
    state: "idle",
    message: "No changes.",
  });

  const savedActionJsonById = serializeActionsById(savedActions);
  const actionEntries: ActionListEntry[] = draftActions.map((action) => ({
    actionId: action.actionId,
    name: action.name,
    order: action.order,
    hasUnsavedChanges:
      serializeCombatActionDef(action) !==
      savedActionJsonById.get(action.actionId),
  }));

  const selectedAction =
    draftActions.find((action) => action.actionId === selectedActionId) ?? null;
  const derivedEffects = selectedAction
    ? actionDerivedEffects(selectedAction)
    : [];
  const selectedActionDiagnostics = selectedActionId
    ? combined.diagnostics.filter(
        (diagnostic) =>
          diagnostic.contentType === CONTENT_TYPES.combatAction &&
          diagnostic.contentId === selectedActionId,
      )
    : [];
  const selectedActionHasUnsavedChanges =
    selectedAction !== null &&
    serializeCombatActionDef(selectedAction) !==
      savedActionJsonById.get(selectedAction.actionId);
  const hasUnsavedChanges = actionEntries.some(
    (entry) => entry.hasUnsavedChanges,
  );
  const isSaving = saveStatus.state === "saving";
  const selectedActionSaveGate = getFileSaveGate(
    selectedAction ? validateCombatActionDef(selectedAction) : [],
    { hasUnsavedChanges: selectedActionHasUnsavedChanges, isSaving },
  );
  const canSaveSelectedAction =
    selectedAction !== null && selectedActionSaveGate.canSave;
  const canResetSelectedAction =
    selectedActionHasUnsavedChanges && !isSaving;
  const displayStatus = getFileSaveStatus(saveStatus, {
    hasUnsavedChanges: selectedActionHasUnsavedChanges,
    errorCount: selectedActionSaveGate.errorCount,
  });

  function selectAction(actionId: string): void {
    setSelectedActionId(actionId);
  }

  function markEditing(): void {
    setSaveStatus((prev) =>
      prev.state === "idle" ? prev : { state: "idle", message: "" },
    );
  }

  function updateSelectedAction(
    updater: (action: CombatActionDef) => CombatActionDef,
  ): void {
    if (!selectedActionId) {
      return;
    }
    setDraftActions((actions) =>
      updateActionDef(actions, selectedActionId, updater),
    );
    markEditing();
  }

  function resetSelectedAction(): void {
    if (!selectedActionId) {
      return;
    }
    const savedAction = savedActions.find(
      (action) => action.actionId === selectedActionId,
    );
    if (!savedAction) {
      return;
    }
    setDraftActions((actions) =>
      updateActionDef(actions, selectedActionId, () => savedAction),
    );
    setSaveStatus({ state: "idle", message: "" });
  }

  async function saveSelectedAction(): Promise<void> {
    if (!selectedAction) {
      return;
    }
    if (!selectedActionHasUnsavedChanges) {
      setSaveStatus({ state: "idle", message: "" });
      return;
    }
    const saveGate = getFileSaveGate(validateCombatActionDef(selectedAction), {
      hasUnsavedChanges: selectedActionHasUnsavedChanges,
      isSaving,
    });
    if (saveGate.errorCount > 0) {
      setSaveStatus({
        state: "error",
        message: formatFileSaveBlocker(saveGate.errorCount),
      });
      return;
    }

    const content = serializeCombatActionDef(selectedAction);
    setSaveStatus({ state: "saving", message: "Saving..." });
    const result = await saveEditorContent(
      actionContentPath(selectedAction.actionId),
      content,
    );
    if (!result.ok) {
      setSaveStatus({ state: "error", message: result.error });
      return;
    }

    setSavedActions((actions) =>
      updateActionDef(actions, selectedAction.actionId, () => selectedAction),
    );
    setSaveStatus({ state: "saved", message: `Saved ${result.path}.` });
  }

  return {
    actions: actionEntries,
    selectedActionId,
    selectedAction,
    derivedEffects,
    selectedActionDiagnostics,
    errorCount: combined.errorCount,
    warningCount: combined.warningCount,
    hasUnsavedChanges,
    selectedActionHasUnsavedChanges,
    canSaveSelectedAction,
    canResetSelectedAction,
    isSaving,
    saveStatus: displayStatus,
    selectAction,
    updateSelectedAction,
    resetSelectedAction,
    saveSelectedAction,
  };
}
