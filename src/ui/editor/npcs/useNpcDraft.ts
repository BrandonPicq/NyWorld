import { useEffect, useMemo, useState } from "react";
import {
  CONTENT_TYPES,
  validateAllContent,
  validateNpcDef,
  type ContentCatalogSnapshot,
  type ContentDiagnostic,
  type ContentReference,
  type DialogueDefMap,
  type NpcDef,
} from "../../../engine";
import { saveEditorContent } from "../editorSaveClient";
import {
  formatFileSaveBlocker,
  getFileSaveGate,
  getFileSaveStatus,
  type SaveStatus,
} from "../editorModel";
import type { CombinedDraftView, DraftSlot } from "../editorDraftTypes";
import type { DialogueDraftSlot } from "../dialogues/useDialogueDraft";
import {
  addDefaultDialogueForNpc,
  createDefaultDialogueId,
  createNpcDef,
  createNpcDraftSnapshot,
  createNpcDraftValidationContext,
  dialogueContentPathForNpc,
  hasDialogueId,
  listNpcDefs,
  npcContentPath,
  removeNpcDef,
  serializeDefaultDialogueFileForNpc,
  serializeNpcDef,
  serializeNpcDefsById,
  updateNpcDef,
  upsertNpcDef,
  validateNewNpcId,
  validateNewNpcName,
  type EditorNpcEntry,
} from "./npcEditorModel";

export interface NpcDraftSlot {
  npcs: DraftSlot<NpcDef[]>;
  savedNpcs: DraftSlot<NpcDef[]>;
  /** Shared with the Dialogues tab, so a new default dialogue is visible there. */
  dialogue: DialogueDraftSlot;
}

export interface NpcListEntry extends EditorNpcEntry {
  hasUnsavedChanges: boolean;
}

export interface NpcDraftController {
  npcs: NpcListEntry[];
  selectedNpcId: string;
  selectedNpc: NpcDef | null;
  dialogueIds: string[];
  classIds: string[];
  raceIds: string[];
  selectedNpcDiagnostics: ContentDiagnostic[];
  selectedNpcReferences: ContentReference[];
  errorCount: number;
  warningCount: number;
  hasUnsavedChanges: boolean;
  selectedNpcHasUnsavedChanges: boolean;
  canSaveSelectedNpc: boolean;
  isSaving: boolean;
  saveStatus: SaveStatus;
  newNpcIdDraft: string;
  newNpcNameDraft: string;
  newNpcDialogueIdDraft: string;
  generatedDefaultDialogueId: string;
  newNpcIdErrors: string[];
  newNpcNameErrors: string[];
  canCreateNpcDraft: boolean;
  canCreateNpcWithDefaultDialogue: boolean;
  selectNpc: (npcId: string) => void;
  setNewNpcIdDraft: (npcId: string) => void;
  setNewNpcNameDraft: (name: string) => void;
  setNewNpcDialogueIdDraft: (dialogueId: string) => void;
  createNpcDraft: () => void;
  createNpcWithDefaultDialogue: () => Promise<void>;
  updateSelectedNpc: (updater: (npc: NpcDef) => NpcDef) => void;
  resetSelectedNpc: () => void;
  saveSelectedNpc: () => Promise<void>;
}

export function useNpcDraft(
  base: ContentCatalogSnapshot,
  slot: NpcDraftSlot,
  combined: CombinedDraftView,
): NpcDraftController {
  const draftNpcs = slot.npcs.value;
  const setDraftNpcs = slot.npcs.set;
  const savedNpcs = slot.savedNpcs.value;
  const setSavedNpcs = slot.savedNpcs.set;
  const draftDialogueFiles = slot.dialogue.draft.value;
  const setDraftDialogueFiles = slot.dialogue.draft.set;
  const setSavedDialogueFiles = slot.dialogue.saved.set;

  const [selectedNpcId, setSelectedNpcId] = useState(firstNpcId(base.npcs));
  const [newNpcIdDraft, setNewNpcIdDraft] = useState("");
  const [newNpcNameDraft, setNewNpcNameDraft] = useState("");
  const [newNpcDialogueIdDraft, setNewNpcDialogueIdDraft] = useState(
    firstDialogueId(base.dialogues),
  );
  const [saveStatus, setSaveStatus] = useState<SaveStatus>({
    state: "idle",
    message: "No changes.",
  });

  const savedNpcJsonById = useMemo(
    () => serializeNpcDefsById(savedNpcs),
    [savedNpcs],
  );
  const npcEntries = useMemo(
    () =>
      listNpcDefs(draftNpcs).map((entry) => {
        const draftNpc = draftNpcs.find((npc) => npc.npcId === entry.npcId);
        return {
          ...entry,
          hasUnsavedChanges:
            !draftNpc ||
            serializeNpcDef(draftNpc) !== savedNpcJsonById.get(entry.npcId),
        };
      }),
    [draftNpcs, savedNpcJsonById],
  );
  const dialogueIds = useMemo(
    () =>
      Object.keys(combined.snapshot.dialogues).sort((a, b) =>
        a.localeCompare(b),
      ),
    [combined.snapshot.dialogues],
  );
  const classIds = useMemo(
    () =>
      combined.snapshot.classes
        .map((classDef) => classDef.classId)
        .sort((a, b) => a.localeCompare(b)),
    [combined.snapshot.classes],
  );
  const raceIds = useMemo(
    () =>
      combined.snapshot.races
        .map((race) => race.raceId)
        .sort((a, b) => a.localeCompare(b)),
    [combined.snapshot.races],
  );
  const selectedNpc =
    draftNpcs.find((npc) => npc.npcId === selectedNpcId) ?? null;
  const selectedNpcDiagnostics = selectedNpcId
    ? combined.diagnostics.filter(
        (diagnostic) =>
          diagnostic.contentType === CONTENT_TYPES.npc &&
          diagnostic.contentId === selectedNpcId,
      )
    : [];
  const selectedNpcReferences = selectedNpcId
    ? combined.graph.getReferencesTo({ type: CONTENT_TYPES.npc, id: selectedNpcId })
    : [];
  const selectedNpcHasUnsavedChanges =
    selectedNpc !== null &&
    serializeNpcDef(selectedNpc) !== savedNpcJsonById.get(selectedNpc.npcId);
  const generatedDefaultDialogueId = newNpcIdDraft.trim()
    ? createDefaultDialogueId(newNpcIdDraft)
    : "";
  const generatedDialogueAlreadyExists =
    generatedDefaultDialogueId !== "" &&
    hasDialogueId(base, draftDialogueFiles, generatedDefaultDialogueId);
  const newNpcIdErrors = validateNewNpcId(newNpcIdDraft, draftNpcs);
  const newNpcNameErrors = validateNewNpcName(newNpcNameDraft);
  const hasAnyUnsavedNpc = npcEntries.some((entry) => entry.hasUnsavedChanges);
  const hasUnsavedChanges = hasAnyUnsavedNpc;
  const isSaving = saveStatus.state === "saving";
  const dialogueExists = combined.context.dialogueIds.has(newNpcDialogueIdDraft);
  const canCreateNpcDraft =
    newNpcIdErrors.length === 0 &&
    newNpcNameErrors.length === 0 &&
    dialogueExists &&
    !isSaving;
  const canCreateNpcWithDefaultDialogue =
    newNpcIdErrors.length === 0 &&
    newNpcNameErrors.length === 0 &&
    generatedDefaultDialogueId !== "" &&
    !generatedDialogueAlreadyExists &&
    !isSaving;
  const selectedNpcSaveGate = getFileSaveGate(
    selectedNpc ? validateNpcDef(selectedNpc, combined.context) : [],
    { hasUnsavedChanges: selectedNpcHasUnsavedChanges, isSaving },
  );
  const canSaveSelectedNpc =
    selectedNpc !== null && selectedNpcSaveGate.canSave;
  const displayStatus = getFileSaveStatus(saveStatus, {
    hasUnsavedChanges: selectedNpcHasUnsavedChanges,
    errorCount: selectedNpcSaveGate.errorCount,
  });

  useEffect(() => {
    if (!selectedNpcId || draftNpcs.some((npc) => npc.npcId === selectedNpcId)) {
      return;
    }
    setSelectedNpcId(firstNpcId(draftNpcs));
  }, [draftNpcs, selectedNpcId]);

  useEffect(() => {
    if (combined.context.dialogueIds.has(newNpcDialogueIdDraft)) {
      return;
    }
    setNewNpcDialogueIdDraft(dialogueIds[0] ?? "");
  }, [combined.context.dialogueIds, dialogueIds, newNpcDialogueIdDraft]);

  function selectNpc(npcId: string): void {
    setSelectedNpcId(npcId);
  }

  function markEditing(): void {
    setSaveStatus((prev) =>
      prev.state === "idle" ? prev : { state: "idle", message: "" },
    );
  }

  function createNpcDraft(): void {
    if (!canCreateNpcDraft) {
      setSaveStatus({
        state: "error",
        message: firstCreationError(
          newNpcIdErrors,
          newNpcNameErrors,
          dialogueExists,
        ),
      });
      return;
    }

    const npc = createNpcDef({
      npcId: newNpcIdDraft,
      name: newNpcNameDraft,
      defaultDialogueId: newNpcDialogueIdDraft,
    });
    setDraftNpcs((npcs) => upsertNpcDef(npcs, npc));
    setSelectedNpcId(npc.npcId);
    clearNewNpcDraft();
    markEditing();
  }

  async function createNpcWithDefaultDialogue(): Promise<void> {
    if (!canCreateNpcWithDefaultDialogue) {
      setSaveStatus({
        state: "error",
        message: firstCreationError(newNpcIdErrors, newNpcNameErrors, false),
      });
      return;
    }

    const npc = createNpcDef({
      npcId: newNpcIdDraft,
      name: newNpcNameDraft,
      defaultDialogueId: generatedDefaultDialogueId,
    });
    const nextNpcs = upsertNpcDef(draftNpcs, npc);
    const nextDialogueFiles = addDefaultDialogueForNpc(draftDialogueFiles, npc);
    const nextSnapshot = createNpcDraftSnapshot(
      combined.snapshot,
      nextNpcs,
      nextDialogueFiles,
    );
    const nextContext = createNpcDraftValidationContext(
      combined.context,
      base,
      nextNpcs,
      nextDialogueFiles,
    );
    const nextDiagnostics = validateAllContent(nextSnapshot, nextContext);
    if (nextDiagnostics.some((diagnostic) => diagnostic.severity === "error")) {
      setSaveStatus({
        state: "error",
        message: "Resolve errors before saving.",
      });
      return;
    }

    setDraftNpcs(nextNpcs);
    setDraftDialogueFiles(nextDialogueFiles);
    setSelectedNpcId(npc.npcId);
    setSaveStatus({ state: "saving", message: "Saving..." });

    const dialogueResult = await saveEditorContent(
      dialogueContentPathForNpc(npc.npcId),
      serializeDefaultDialogueFileForNpc(nextDialogueFiles, npc.npcId),
    );
    if (!dialogueResult.ok) {
      setSaveStatus({ state: "error", message: dialogueResult.error });
      return;
    }
    setSavedDialogueFiles(nextDialogueFiles);

    const npcResult = await saveEditorContent(
      npcContentPath(npc.npcId),
      serializeNpcDef(npc),
    );
    if (!npcResult.ok) {
      setSaveStatus({ state: "error", message: npcResult.error });
      return;
    }

    setSavedNpcs(nextNpcs);
    clearNewNpcDraft();
    setSaveStatus({
      state: "saved",
      message: `Saved ${dialogueResult.path} and ${npcResult.path}.`,
    });
  }

  function updateSelectedNpc(updater: (npc: NpcDef) => NpcDef): void {
    if (!selectedNpcId) {
      return;
    }
    setDraftNpcs((npcs) => updateNpcDef(npcs, selectedNpcId, updater));
    markEditing();
  }

  function resetSelectedNpc(): void {
    if (!selectedNpcId) {
      return;
    }

    const savedNpc = savedNpcs.find((npc) => npc.npcId === selectedNpcId);
    setDraftNpcs((npcs) =>
      savedNpc
        ? upsertNpcDef(npcs, savedNpc)
        : removeNpcDef(npcs, selectedNpcId),
    );
    setSaveStatus({ state: "idle", message: "" });
  }

  async function saveSelectedNpc(): Promise<void> {
    if (!selectedNpc) {
      return;
    }
    if (!selectedNpcHasUnsavedChanges) {
      setSaveStatus({ state: "idle", message: "" });
      return;
    }
    const saveGate = getFileSaveGate(
      validateNpcDef(selectedNpc, combined.context),
      { hasUnsavedChanges: selectedNpcHasUnsavedChanges, isSaving },
    );
    if (saveGate.errorCount > 0) {
      setSaveStatus({
        state: "error",
        message: formatFileSaveBlocker(saveGate.errorCount),
      });
      return;
    }

    const content = serializeNpcDef(selectedNpc);
    setSaveStatus({ state: "saving", message: "Saving..." });
    const result = await saveEditorContent(
      npcContentPath(selectedNpc.npcId),
      content,
    );
    if (!result.ok) {
      setSaveStatus({ state: "error", message: result.error });
      return;
    }

    setSavedNpcs((npcs) => upsertNpcDef(npcs, selectedNpc));
    setSaveStatus({ state: "saved", message: `Saved ${result.path}.` });
  }

  function clearNewNpcDraft(): void {
    setNewNpcIdDraft("");
    setNewNpcNameDraft("");
    setNewNpcDialogueIdDraft(dialogueIds[0] ?? "");
  }

  return {
    npcs: npcEntries,
    selectedNpcId,
    selectedNpc,
    dialogueIds,
    classIds,
    raceIds,
    selectedNpcDiagnostics,
    selectedNpcReferences,
    errorCount: combined.errorCount,
    warningCount: combined.warningCount,
    hasUnsavedChanges,
    selectedNpcHasUnsavedChanges,
    canSaveSelectedNpc,
    isSaving,
    saveStatus: displayStatus,
    newNpcIdDraft,
    newNpcNameDraft,
    newNpcDialogueIdDraft,
    generatedDefaultDialogueId,
    newNpcIdErrors,
    newNpcNameErrors,
    canCreateNpcDraft,
    canCreateNpcWithDefaultDialogue,
    selectNpc,
    setNewNpcIdDraft,
    setNewNpcNameDraft,
    setNewNpcDialogueIdDraft,
    createNpcDraft,
    createNpcWithDefaultDialogue,
    updateSelectedNpc,
    resetSelectedNpc,
    saveSelectedNpc,
  };
}

function firstNpcId(npcs: readonly NpcDef[]): string {
  return (
    [...npcs].sort((a, b) => a.npcId.localeCompare(b.npcId))[0]?.npcId ?? ""
  );
}

function firstDialogueId(dialogues: DialogueDefMap): string {
  return Object.keys(dialogues).sort((a, b) => a.localeCompare(b))[0] ?? "";
}

function firstCreationError(
  idErrors: readonly string[],
  nameErrors: readonly string[],
  hasDialogue: boolean,
): string {
  return (
    idErrors[0] ??
    nameErrors[0] ??
    (hasDialogue ? "Cannot create NPC." : "Default dialogue is required.")
  );
}
