import { useEffect, useMemo, useState } from "react";
import {
  CONTENT_TYPES,
  validateQuestDef,
  type ContentCatalogSnapshot,
  type ContentDiagnostic,
  type ContentReference,
  type QuestDef,
} from "../../../engine";
import { deleteEditorContent, saveEditorContent } from "../editorSaveClient";
import { draftHasBlockingErrors, type SaveStatus } from "../editorModel";
import type { CombinedDraftView, DraftSlot } from "../editorDraftTypes";
import {
  cloneQuestDefs,
  createQuestDef,
  listQuestDefs,
  questContentPath,
  removeQuestDef,
  serializeQuestDef,
  serializeQuestDefsById,
  updateQuestDef,
  upsertQuestDef,
  validateNewQuestId,
  type EditorQuestEntry,
} from "./questEditorModel";

export interface QuestDraftSlot {
  draft: DraftSlot<QuestDef[]>;
  saved: DraftSlot<QuestDef[]>;
}

export function createQuestDraftState(
  base: ContentCatalogSnapshot,
): QuestDef[] {
  return cloneQuestDefs(base.quests);
}

export interface QuestListEntry extends EditorQuestEntry {
  hasUnsavedChanges: boolean;
}

export interface QuestDraftController {
  quests: QuestListEntry[];
  selectedQuestId: string;
  selectedQuest: QuestDef | null;
  npcIds: string[];
  dialogueIds: string[];
  itemIds: string[];
  zoneIds: string[];
  selectedQuestDiagnostics: ContentDiagnostic[];
  selectedQuestReferences: ContentReference[];
  errorCount: number;
  warningCount: number;
  hasUnsavedChanges: boolean;
  selectedQuestHasUnsavedChanges: boolean;
  canSaveSelectedQuest: boolean;
  canResetSelectedQuest: boolean;
  canDeleteSelectedQuest: boolean;
  isSaving: boolean;
  saveStatus: SaveStatus;
  newQuestIdDraft: string;
  newQuestNameDraft: string;
  newQuestIdErrors: string[];
  canCreateQuest: boolean;
  selectQuest: (questId: string) => void;
  setNewQuestIdDraft: (questId: string) => void;
  setNewQuestNameDraft: (name: string) => void;
  createQuest: () => void;
  updateSelectedQuest: (updater: (quest: QuestDef) => QuestDef) => void;
  resetSelectedQuest: () => void;
  saveSelectedQuest: () => Promise<void>;
  deleteSelectedQuest: () => Promise<void>;
}

export function useQuestDraft(
  slot: QuestDraftSlot,
  combined: CombinedDraftView,
): QuestDraftController {
  const draftQuests = slot.draft.value;
  const setDraftQuests = slot.draft.set;
  const savedQuests = slot.saved.value;
  const setSavedQuests = slot.saved.set;

  const [selectedQuestId, setSelectedQuestId] = useState(
    () => firstQuestId(draftQuests),
  );
  const [newQuestIdDraft, setNewQuestIdDraft] = useState("");
  const [newQuestNameDraft, setNewQuestNameDraft] = useState("");
  const [saveStatus, setSaveStatus] = useState<SaveStatus>({
    state: "idle",
    message: "No changes.",
  });

  const savedQuestJsonById = useMemo(
    () => serializeQuestDefsById(savedQuests),
    [savedQuests],
  );
  const questEntries = useMemo(
    () =>
      listQuestDefs(draftQuests).map((entry) => {
        const draftQuest = draftQuests.find(
          (quest) => quest.questId === entry.questId,
        );
        return {
          ...entry,
          hasUnsavedChanges:
            (draftQuest ? serializeQuestDef(draftQuest) : undefined) !==
            savedQuestJsonById.get(entry.questId),
        };
      }),
    [draftQuests, savedQuestJsonById],
  );
  const npcIds = useMemo(
    () =>
      combined.snapshot.npcs
        .map((npc) => npc.npcId)
        .sort((a, b) => a.localeCompare(b)),
    [combined.snapshot.npcs],
  );
  const dialogueIds = useMemo(
    () =>
      Object.keys(combined.snapshot.dialogues).sort((a, b) =>
        a.localeCompare(b),
      ),
    [combined.snapshot.dialogues],
  );
  const itemIds = useMemo(
    () => Object.keys(combined.snapshot.items).sort((a, b) => a.localeCompare(b)),
    [combined.snapshot.items],
  );
  const zoneIds = useMemo(
    () => Object.keys(combined.snapshot.zones).sort((a, b) => a.localeCompare(b)),
    [combined.snapshot.zones],
  );

  const selectedQuest =
    draftQuests.find((quest) => quest.questId === selectedQuestId) ?? null;
  const selectedQuestDiagnostics = selectedQuestId
    ? combined.diagnostics.filter(
        (diagnostic) =>
          diagnostic.contentType === CONTENT_TYPES.quest &&
          diagnostic.contentId === selectedQuestId,
      )
    : [];
  const selectedQuestReferences = selectedQuestId
    ? combined.graph.getReferencesTo({
        type: CONTENT_TYPES.quest,
        id: selectedQuestId,
      })
    : [];
  const selectedQuestHasUnsavedChanges =
    selectedQuest !== null &&
    serializeQuestDef(selectedQuest) !==
      savedQuestJsonById.get(selectedQuest.questId);
  const hasUnsavedChanges = hasAnyUnsavedQuest(draftQuests, savedQuests);
  const isSaving = saveStatus.state === "saving";
  const newQuestIdErrors = validateNewQuestId(newQuestIdDraft, draftQuests);
  const canCreateQuest =
    newQuestIdErrors.length === 0 &&
    newQuestNameDraft.trim().length > 0 &&
    !isSaving;
  const canSaveSelectedQuest =
    selectedQuest !== null &&
    selectedQuestHasUnsavedChanges &&
    combined.errorCount === 0 &&
    !isSaving;
  const canResetSelectedQuest =
    selectedQuestId !== "" &&
    hasSelectedQuestUnsavedState(selectedQuestId, draftQuests, savedQuests) &&
    !isSaving;
  const canDeleteSelectedQuest =
    selectedQuest !== null &&
    selectedQuestReferences.length === 0 &&
    !isSaving;
  const displayStatus: SaveStatus =
    saveStatus.state === "idle"
      ? {
          state: "idle",
          message: hasUnsavedChanges ? "Unsaved changes." : "No changes.",
        }
      : saveStatus;

  useEffect(() => {
    if (
      !selectedQuestId ||
      draftQuests.some((quest) => quest.questId === selectedQuestId)
    ) {
      return;
    }
    setSelectedQuestId(firstQuestId(draftQuests));
  }, [draftQuests, selectedQuestId]);

  function selectQuest(questId: string): void {
    setSelectedQuestId(questId);
  }

  function markEditing(): void {
    setSaveStatus((prev) =>
      prev.state === "idle" ? prev : { state: "idle", message: "" },
    );
  }

  function createQuest(): void {
    if (!canCreateQuest) {
      setSaveStatus({
        state: "error",
        message:
          newQuestIdErrors[0] ?? "A quest id and name are required.",
      });
      return;
    }
    const quest = createQuestDef({
      questId: newQuestIdDraft,
      name: newQuestNameDraft,
    });
    setDraftQuests((quests) => upsertQuestDef(quests, quest));
    setSelectedQuestId(quest.questId);
    setNewQuestIdDraft("");
    setNewQuestNameDraft("");
    markEditing();
  }

  function updateSelectedQuest(updater: (quest: QuestDef) => QuestDef): void {
    if (!selectedQuestId) {
      return;
    }
    setDraftQuests((quests) =>
      updateQuestDef(quests, selectedQuestId, updater),
    );
    markEditing();
  }

  function resetSelectedQuest(): void {
    if (!selectedQuestId) {
      return;
    }
    const savedQuest = savedQuests.find(
      (quest) => quest.questId === selectedQuestId,
    );
    setDraftQuests((quests) =>
      savedQuest
        ? upsertQuestDef(quests, savedQuest)
        : removeQuestDef(quests, selectedQuestId),
    );
    setSaveStatus({ state: "idle", message: "" });
  }

  async function saveSelectedQuest(): Promise<void> {
    if (!selectedQuest) {
      return;
    }
    if (!selectedQuestHasUnsavedChanges) {
      setSaveStatus({ state: "idle", message: "" });
      return;
    }
    if (
      draftHasBlockingErrors(combined.snapshot, combined.context) ||
      validateQuestDef(selectedQuest, combined.context).length > 0
    ) {
      setSaveStatus({
        state: "error",
        message: "Resolve errors before saving.",
      });
      return;
    }

    const content = serializeQuestDef(selectedQuest);
    setSaveStatus({ state: "saving", message: "Saving..." });
    const result = await saveEditorContent(
      questContentPath(selectedQuest.questId),
      content,
    );
    if (!result.ok) {
      setSaveStatus({ state: "error", message: result.error });
      return;
    }

    setSavedQuests((quests) => upsertQuestDef(quests, selectedQuest));
    setSaveStatus({ state: "saved", message: `Saved ${result.path}.` });
  }

  async function deleteSelectedQuest(): Promise<void> {
    if (!selectedQuest || !canDeleteSelectedQuest) {
      return;
    }
    if (selectedQuestReferences.length > 0) {
      setSaveStatus({
        state: "error",
        message: `Quest "${selectedQuest.questId}" is still referenced.`,
      });
      return;
    }

    const savedQuest = savedQuests.find(
      (quest) => quest.questId === selectedQuest.questId,
    );
    if (!savedQuest) {
      setDraftQuests((quests) => removeQuestDef(quests, selectedQuest.questId));
      setSaveStatus({ state: "idle", message: "" });
      return;
    }

    setSaveStatus({ state: "saving", message: "Deleting..." });
    const result = await deleteEditorContent(
      questContentPath(selectedQuest.questId),
    );
    if (!result.ok) {
      setSaveStatus({ state: "error", message: result.error });
      return;
    }

    setDraftQuests((quests) => removeQuestDef(quests, selectedQuest.questId));
    setSavedQuests((quests) => removeQuestDef(quests, selectedQuest.questId));
    setSaveStatus({ state: "saved", message: `Deleted ${result.path}.` });
  }

  return {
    quests: questEntries,
    selectedQuestId,
    selectedQuest,
    npcIds,
    dialogueIds,
    itemIds,
    zoneIds,
    selectedQuestDiagnostics,
    selectedQuestReferences,
    errorCount: combined.errorCount,
    warningCount: combined.warningCount,
    hasUnsavedChanges,
    selectedQuestHasUnsavedChanges,
    canSaveSelectedQuest,
    canResetSelectedQuest,
    canDeleteSelectedQuest,
    isSaving,
    saveStatus: displayStatus,
    newQuestIdDraft,
    newQuestNameDraft,
    newQuestIdErrors,
    canCreateQuest,
    selectQuest,
    setNewQuestIdDraft,
    setNewQuestNameDraft,
    createQuest,
    updateSelectedQuest,
    resetSelectedQuest,
    saveSelectedQuest,
    deleteSelectedQuest,
  };
}

function firstQuestId(quests: readonly QuestDef[]): string {
  return (
    [...quests].sort((a, b) => a.questId.localeCompare(b.questId))[0]?.questId ??
    ""
  );
}

function hasAnyUnsavedQuest(
  draftQuests: readonly QuestDef[],
  savedQuests: readonly QuestDef[],
): boolean {
  const draftJsonById = serializeQuestDefsById(draftQuests);
  const savedJsonById = serializeQuestDefsById(savedQuests);
  const allIds = new Set([...draftJsonById.keys(), ...savedJsonById.keys()]);

  for (const questId of allIds) {
    if (draftJsonById.get(questId) !== savedJsonById.get(questId)) {
      return true;
    }
  }

  return false;
}

function hasSelectedQuestUnsavedState(
  questId: string,
  draftQuests: readonly QuestDef[],
  savedQuests: readonly QuestDef[],
): boolean {
  const draftQuest = draftQuests.find((quest) => quest.questId === questId);
  const savedQuest = savedQuests.find((quest) => quest.questId === questId);
  const draftJson = draftQuest ? serializeQuestDef(draftQuest) : undefined;
  const savedJson = savedQuest ? serializeQuestDef(savedQuest) : undefined;
  return draftJson !== savedJson;
}
