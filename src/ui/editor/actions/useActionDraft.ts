import { useDeferredValue, useMemo, useState } from "react";
import {
  CONTENT_TYPES,
  createRuntimeContentValidationContext,
  validateAllContent,
  validateCombatActionDef,
  type CombatActionDef,
  type ContentCatalogSnapshot,
  type ContentDiagnostic,
} from "../../../engine";
import { saveEditorContent } from "../editorSaveClient";
import { draftHasBlockingErrors, type SaveStatus } from "../editorModel";
import {
  actionContentPath,
  actionDerivedEffects,
  cloneCombatActionDefs,
  createActionDraftSnapshot,
  listAuthoredCombatActionDefs,
  serializeActionsById,
  serializeCombatActionDef,
  updateActionDef,
} from "./actionEditorModel";

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
  diagnostics: ContentDiagnostic[];
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
  baseSnapshot: ContentCatalogSnapshot,
): ActionDraftController {
  const validationContext = useMemo(
    () => createRuntimeContentValidationContext(),
    [],
  );
  const [draftActions, setDraftActions] = useState<CombatActionDef[]>(() =>
    listAuthoredCombatActionDefs(baseSnapshot),
  );
  const [savedActions, setSavedActions] = useState<CombatActionDef[]>(() =>
    listAuthoredCombatActionDefs(baseSnapshot),
  );
  const [selectedActionId, setSelectedActionId] = useState<string>(
    () => draftActions[0]?.actionId ?? "",
  );
  const [saveStatus, setSaveStatus] = useState<SaveStatus>({
    state: "idle",
    message: "No changes.",
  });

  // Defer whole-bundle validation off the typing path; save stays live.
  const deferredDraftActions = useDeferredValue(draftActions);
  const diagnostics = useMemo(
    () =>
      validateAllContent(
        createActionDraftSnapshot(baseSnapshot, deferredDraftActions),
        validationContext,
      ),
    [baseSnapshot, deferredDraftActions, validationContext],
  );
  const savedActionJsonById = useMemo(
    () => serializeActionsById(savedActions),
    [savedActions],
  );
  const actionEntries = useMemo<ActionListEntry[]>(
    () =>
      draftActions.map((action) => ({
        actionId: action.actionId,
        name: action.name,
        order: action.order,
        hasUnsavedChanges:
          serializeCombatActionDef(action) !==
          savedActionJsonById.get(action.actionId),
      })),
    [draftActions, savedActionJsonById],
  );

  const selectedAction =
    draftActions.find((action) => action.actionId === selectedActionId) ?? null;
  const derivedEffects = selectedAction
    ? actionDerivedEffects(selectedAction)
    : [];
  const selectedActionDiagnostics = selectedActionId
    ? diagnostics.filter(
        (diagnostic) =>
          diagnostic.contentType === CONTENT_TYPES.combatAction &&
          diagnostic.contentId === selectedActionId,
      )
    : [];
  const errorCount = diagnostics.filter(
    (diagnostic) => diagnostic.severity === "error",
  ).length;
  const warningCount = diagnostics.length - errorCount;
  const selectedActionHasUnsavedChanges =
    selectedAction !== null &&
    serializeCombatActionDef(selectedAction) !==
      savedActionJsonById.get(selectedAction.actionId);
  const hasUnsavedChanges = actionEntries.some(
    (entry) => entry.hasUnsavedChanges,
  );
  const isSaving = saveStatus.state === "saving";
  const canSaveSelectedAction =
    selectedAction !== null &&
    selectedActionHasUnsavedChanges &&
    errorCount === 0 &&
    !isSaving;
  const canResetSelectedAction =
    selectedActionHasUnsavedChanges && !isSaving;
  const displayStatus: SaveStatus =
    saveStatus.state === "idle"
      ? {
          state: "idle",
          message: hasUnsavedChanges ? "Unsaved changes." : "No changes.",
        }
      : saveStatus;

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
    if (
      draftHasBlockingErrors(
        createActionDraftSnapshot(baseSnapshot, draftActions),
        validationContext,
      ) ||
      validateCombatActionDef(selectedAction).length > 0
    ) {
      setSaveStatus({
        state: "error",
        message: "Resolve errors before saving.",
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
    diagnostics,
    selectedActionDiagnostics,
    errorCount,
    warningCount,
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
