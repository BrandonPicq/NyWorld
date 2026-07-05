import { useEffect, useMemo, useState } from "react";
import {
  buildContentReferenceGraph,
  CONTENT_TYPES,
  createRuntimeContentValidationContext,
  validateAllContent,
  validateNpcDef,
  type ContentCatalogSnapshot,
  type ContentDiagnostic,
  type ContentReference,
  type DialogueDefMap,
  type NpcDef,
} from "../../../engine";
import {
  cloneDialogueFiles,
} from "../dialogues/dialogueEditorModel";
import { saveEditorContent } from "../editorSaveClient";
import type { SaveStatus } from "../editorModel";
import {
  addDefaultDialogueForNpc,
  cloneNpcDefs,
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

export interface NpcListEntry extends EditorNpcEntry {
  hasUnsavedChanges: boolean;
}

export interface NpcDraftController {
  npcs: NpcListEntry[];
  selectedNpcId: string;
  selectedNpc: NpcDef | null;
  dialogueIds: string[];
  diagnostics: ContentDiagnostic[];
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
  baseSnapshot: ContentCatalogSnapshot,
): NpcDraftController {
  const baseValidationContext = useMemo(
    () => createRuntimeContentValidationContext(),
    [],
  );
  const [draftNpcs, setDraftNpcs] = useState<NpcDef[]>(() =>
    cloneNpcDefs(baseSnapshot.npcs),
  );
  const [savedNpcs, setSavedNpcs] = useState<NpcDef[]>(() =>
    cloneNpcDefs(baseSnapshot.npcs),
  );
  const [draftDialogueFiles, setDraftDialogueFiles] = useState(() =>
    cloneDialogueFiles(baseSnapshot.dialogueFiles),
  );
  const [savedDialogueFiles, setSavedDialogueFiles] = useState(() =>
    cloneDialogueFiles(baseSnapshot.dialogueFiles),
  );
  const [selectedNpcId, setSelectedNpcId] = useState(
    firstNpcId(baseSnapshot.npcs),
  );
  const [newNpcIdDraft, setNewNpcIdDraft] = useState("");
  const [newNpcNameDraft, setNewNpcNameDraft] = useState("");
  const [newNpcDialogueIdDraft, setNewNpcDialogueIdDraft] = useState(
    firstDialogueId(baseSnapshot.dialogues),
  );
  const [saveStatus, setSaveStatus] = useState<SaveStatus>({
    state: "idle",
    message: "No changes.",
  });

  const draftSnapshot = useMemo(
    () => createNpcDraftSnapshot(baseSnapshot, draftNpcs, draftDialogueFiles),
    [baseSnapshot, draftDialogueFiles, draftNpcs],
  );
  const validationContext = useMemo(
    () =>
      createNpcDraftValidationContext(
        baseValidationContext,
        baseSnapshot,
        draftNpcs,
        draftDialogueFiles,
      ),
    [baseSnapshot, baseValidationContext, draftDialogueFiles, draftNpcs],
  );
  const diagnostics = useMemo(
    () => validateAllContent(draftSnapshot, validationContext),
    [draftSnapshot, validationContext],
  );
  const graph = useMemo(
    () => buildContentReferenceGraph(draftSnapshot),
    [draftSnapshot],
  );
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
      Object.keys(draftSnapshot.dialogues).sort((a, b) =>
        a.localeCompare(b),
      ),
    [draftSnapshot.dialogues],
  );
  const selectedNpc =
    draftNpcs.find((npc) => npc.npcId === selectedNpcId) ?? null;
  const selectedNpcDiagnostics = selectedNpcId
    ? diagnostics.filter(
        (diagnostic) =>
          diagnostic.contentType === CONTENT_TYPES.npc &&
          diagnostic.contentId === selectedNpcId,
      )
    : [];
  const selectedNpcReferences = selectedNpcId
    ? graph.getReferencesTo({ type: CONTENT_TYPES.npc, id: selectedNpcId })
    : [];
  const errorCount = diagnostics.filter(
    (diagnostic) => diagnostic.severity === "error",
  ).length;
  const warningCount = diagnostics.length - errorCount;
  const selectedNpcHasUnsavedChanges =
    selectedNpc !== null &&
    serializeNpcDef(selectedNpc) !== savedNpcJsonById.get(selectedNpc.npcId);
  const generatedDefaultDialogueId = newNpcIdDraft.trim()
    ? createDefaultDialogueId(newNpcIdDraft)
    : "";
  const generatedDialogueAlreadyExists =
    generatedDefaultDialogueId !== "" &&
    hasDialogueId(
      baseSnapshot,
      draftDialogueFiles,
      generatedDefaultDialogueId,
    );
  const newNpcIdErrors = validateNewNpcId(newNpcIdDraft, draftNpcs);
  const newNpcNameErrors = validateNewNpcName(newNpcNameDraft);
  const hasAnyUnsavedNpc = npcEntries.some((entry) => entry.hasUnsavedChanges);
  const hasAnyUnsavedDialogue = hasUnsavedDialogueFiles(
    draftDialogueFiles,
    savedDialogueFiles,
  );
  const hasUnsavedChanges = hasAnyUnsavedNpc || hasAnyUnsavedDialogue;
  const isSaving = saveStatus.state === "saving";
  const canCreateNpcDraft =
    newNpcIdErrors.length === 0 &&
    newNpcNameErrors.length === 0 &&
    validationContext.dialogueIds.has(newNpcDialogueIdDraft) &&
    !isSaving;
  const canCreateNpcWithDefaultDialogue =
    newNpcIdErrors.length === 0 &&
    newNpcNameErrors.length === 0 &&
    generatedDefaultDialogueId !== "" &&
    !generatedDialogueAlreadyExists &&
    !isSaving;
  const canSaveSelectedNpc =
    selectedNpc !== null &&
    selectedNpcHasUnsavedChanges &&
    errorCount === 0 &&
    !isSaving;
  const displayStatus: SaveStatus =
    saveStatus.state === "idle"
      ? {
          state: "idle",
          message: hasUnsavedChanges ? "Unsaved changes." : "No changes.",
        }
      : saveStatus;

  useEffect(() => {
    if (!selectedNpcId || draftNpcs.some((npc) => npc.npcId === selectedNpcId)) {
      return;
    }
    setSelectedNpcId(firstNpcId(draftNpcs));
  }, [draftNpcs, selectedNpcId]);

  useEffect(() => {
    if (validationContext.dialogueIds.has(newNpcDialogueIdDraft)) {
      return;
    }
    setNewNpcDialogueIdDraft(dialogueIds[0] ?? "");
  }, [dialogueIds, newNpcDialogueIdDraft, validationContext.dialogueIds]);

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
          validationContext.dialogueIds.has(newNpcDialogueIdDraft),
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
        message: firstCreationError(
          newNpcIdErrors,
          newNpcNameErrors,
          false,
        ),
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
      baseSnapshot,
      nextNpcs,
      nextDialogueFiles,
    );
    const nextContext = createNpcDraftValidationContext(
      baseValidationContext,
      baseSnapshot,
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
    if (
      errorCount > 0 ||
      validateNpcDef(selectedNpc, validationContext).length > 0
    ) {
      setSaveStatus({
        state: "error",
        message: "Resolve errors before saving.",
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
    diagnostics,
    selectedNpcDiagnostics,
    selectedNpcReferences,
    errorCount,
    warningCount,
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

function hasUnsavedDialogueFiles(
  draftFiles: Record<string, DialogueDefMap>,
  savedFiles: Record<string, DialogueDefMap>,
): boolean {
  const savedJsonByStem = new Map(
    Object.entries(savedFiles).map(([stem, file]) => [
      stem,
      JSON.stringify(file, null, 2),
    ]),
  );
  const allStems = new Set([
    ...Object.keys(draftFiles),
    ...Object.keys(savedFiles),
  ]);

  for (const stem of allStems) {
    const draftFile = draftFiles[stem];
    if (
      !draftFile ||
      JSON.stringify(draftFile, null, 2) !== savedJsonByStem.get(stem)
    ) {
      return true;
    }
  }

  return false;
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
