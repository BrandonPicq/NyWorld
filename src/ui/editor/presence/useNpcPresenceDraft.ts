import { useDeferredValue, useEffect, useMemo, useState } from "react";
import {
  buildContentReferenceGraph,
  CONTENT_TYPES,
  createRuntimeContentValidationContext,
  getAllDialogueIds,
  validateAllContent,
  validateNpcPresenceDef,
  type ContentCatalogSnapshot,
  type ContentDiagnostic,
  type ContentReference,
  type NpcDef,
  type NpcPresenceDef,
} from "../../../engine";
import { deleteEditorContent, saveEditorContent } from "../editorSaveClient";
import { draftHasBlockingErrors, type SaveStatus } from "../editorModel";
import {
  addPresenceScheduleEntry,
  clonePresenceDefs,
  createPresenceDefForNpc,
  createPresenceDraftSnapshot,
  defaultPresencePosition,
  listPresenceNpcEntries,
  presenceContentPath,
  removePresenceDef,
  removePresenceScheduleEntry,
  serializePresenceDef,
  serializePresenceDefsById,
  updatePresenceDef,
  updatePresenceScheduleEntry,
  upsertPresenceDef,
  type EditorPresenceNpcEntry,
} from "./presenceEditorModel";

export interface PresenceNpcListEntry extends EditorPresenceNpcEntry {
  hasUnsavedChanges: boolean;
}

export interface NpcPresenceDraftController {
  npcs: PresenceNpcListEntry[];
  selectedNpcId: string;
  selectedNpc: NpcDef | null;
  selectedPresence: NpcPresenceDef | null;
  zoneIds: string[];
  dialogueIds: string[];
  diagnostics: ContentDiagnostic[];
  selectedPresenceDiagnostics: ContentDiagnostic[];
  selectedPresenceReferences: ContentReference[];
  errorCount: number;
  warningCount: number;
  hasUnsavedChanges: boolean;
  selectedPresenceHasUnsavedChanges: boolean;
  canCreateSelectedPresence: boolean;
  canSaveSelectedPresence: boolean;
  canResetSelectedPresence: boolean;
  canDeleteSelectedPresence: boolean;
  isSaving: boolean;
  saveStatus: SaveStatus;
  selectNpc: (npcId: string) => void;
  createSelectedPresence: () => void;
  addScheduleEntry: () => void;
  updateScheduleEntry: (
    index: number,
    patch: Partial<NpcPresenceDef["schedule"][number]>,
  ) => void;
  removeScheduleEntry: (index: number) => void;
  resetSelectedPresence: () => void;
  saveSelectedPresence: () => Promise<void>;
  deleteSelectedPresence: () => Promise<void>;
}

export function useNpcPresenceDraft(
  baseSnapshot: ContentCatalogSnapshot,
): NpcPresenceDraftController {
  const validationContext = useMemo(
    () => createRuntimeContentValidationContext(),
    [],
  );
  const [draftPresence, setDraftPresence] = useState<NpcPresenceDef[]>(() =>
    clonePresenceDefs(baseSnapshot.npcPresence),
  );
  const [savedPresence, setSavedPresence] = useState<NpcPresenceDef[]>(() =>
    clonePresenceDefs(baseSnapshot.npcPresence),
  );
  const [selectedNpcId, setSelectedNpcId] = useState(
    firstNpcId(baseSnapshot.npcs),
  );
  const [saveStatus, setSaveStatus] = useState<SaveStatus>({
    state: "idle",
    message: "No changes.",
  });

  const draftSnapshot = useMemo(
    () => createPresenceDraftSnapshot(baseSnapshot, draftPresence),
    [baseSnapshot, draftPresence],
  );
  // Defer whole-bundle validation off the typing path; graph and save stay live.
  const deferredDraftPresence = useDeferredValue(draftPresence);
  const diagnostics = useMemo(
    () =>
      validateAllContent(
        createPresenceDraftSnapshot(baseSnapshot, deferredDraftPresence),
        validationContext,
      ),
    [baseSnapshot, deferredDraftPresence, validationContext],
  );
  const graph = useMemo(
    () => buildContentReferenceGraph(draftSnapshot),
    [draftSnapshot],
  );
  const savedPresenceJsonById = useMemo(
    () => serializePresenceDefsById(savedPresence),
    [savedPresence],
  );
  const npcEntries = useMemo(
    () =>
      listPresenceNpcEntries(baseSnapshot.npcs, draftPresence).map((entry) => {
        const draftDef = draftPresence.find(
          (def) => def.npcId === entry.npcId,
        );
        return {
          ...entry,
          hasUnsavedChanges:
            (draftDef ? serializePresenceDef(draftDef) : undefined) !==
            savedPresenceJsonById.get(entry.npcId),
        };
      }),
    [baseSnapshot.npcs, draftPresence, savedPresenceJsonById],
  );
  const zoneIds = useMemo(
    () => Object.keys(baseSnapshot.zones).sort((a, b) => a.localeCompare(b)),
    [baseSnapshot.zones],
  );
  const dialogueIds = useMemo(
    () => [...getAllDialogueIds()].sort((a, b) => a.localeCompare(b)),
    [],
  );

  const selectedNpc =
    baseSnapshot.npcs.find((npc) => npc.npcId === selectedNpcId) ?? null;
  const selectedPresence =
    draftPresence.find((def) => def.npcId === selectedNpcId) ?? null;
  const selectedPresenceDiagnostics = selectedNpcId
    ? diagnostics.filter(
        (diagnostic) =>
          diagnostic.contentType === CONTENT_TYPES.npcPresence &&
          diagnostic.contentId === selectedNpcId,
      )
    : [];
  const selectedPresenceReferences = selectedNpcId
    ? graph.getReferencesTo({
        type: CONTENT_TYPES.npcPresence,
        id: selectedNpcId,
      })
    : [];
  const errorCount = diagnostics.filter(
    (diagnostic) => diagnostic.severity === "error",
  ).length;
  const warningCount = diagnostics.length - errorCount;
  const selectedPresenceHasUnsavedChanges =
    selectedPresence !== null &&
    serializePresenceDef(selectedPresence) !==
      savedPresenceJsonById.get(selectedPresence.npcId);
  const hasUnsavedChanges = hasAnyUnsavedPresence(draftPresence, savedPresence);
  const isSaving = saveStatus.state === "saving";
  const canCreateSelectedPresence =
    selectedNpc !== null && selectedPresence === null && !isSaving;
  const canSaveSelectedPresence =
    selectedPresence !== null &&
    selectedPresenceHasUnsavedChanges &&
    errorCount === 0 &&
    !isSaving;
  const canResetSelectedPresence =
    selectedNpcId !== "" &&
    hasSelectedPresenceUnsavedState(
      selectedNpcId,
      draftPresence,
      savedPresence,
    ) &&
    !isSaving;
  const canDeleteSelectedPresence =
    selectedPresence !== null &&
    selectedPresenceReferences.length === 0 &&
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
      !selectedNpcId ||
      baseSnapshot.npcs.some((npc) => npc.npcId === selectedNpcId)
    ) {
      return;
    }
    setSelectedNpcId(firstNpcId(baseSnapshot.npcs));
  }, [baseSnapshot.npcs, selectedNpcId]);

  function selectNpc(npcId: string): void {
    setSelectedNpcId(npcId);
  }

  function markEditing(): void {
    setSaveStatus((prev) =>
      prev.state === "idle" ? prev : { state: "idle", message: "" },
    );
  }

  function createSelectedPresence(): void {
    if (!canCreateSelectedPresence || !selectedNpc) {
      return;
    }
    const def = createPresenceDefForNpc(
      selectedNpc.npcId,
      defaultPresencePosition(baseSnapshot),
    );
    setDraftPresence((defs) => upsertPresenceDef(defs, def));
    markEditing();
  }

  function updateSelectedPresence(
    updater: (def: NpcPresenceDef) => NpcPresenceDef,
  ): void {
    if (!selectedPresence) {
      return;
    }
    setDraftPresence((defs) =>
      updatePresenceDef(defs, selectedPresence.npcId, updater),
    );
    markEditing();
  }

  function addScheduleEntry(): void {
    const position = defaultPresencePosition(baseSnapshot);
    updateSelectedPresence((def) => addPresenceScheduleEntry(def, position));
  }

  function updateScheduleEntry(
    index: number,
    patch: Partial<NpcPresenceDef["schedule"][number]>,
  ): void {
    updateSelectedPresence((def) =>
      updatePresenceScheduleEntry(def, index, patch),
    );
  }

  function removeScheduleEntry(index: number): void {
    updateSelectedPresence((def) => removePresenceScheduleEntry(def, index));
  }

  function resetSelectedPresence(): void {
    if (!selectedNpcId) {
      return;
    }
    const savedDef = savedPresence.find((def) => def.npcId === selectedNpcId);
    setDraftPresence((defs) =>
      savedDef
        ? upsertPresenceDef(defs, savedDef)
        : removePresenceDef(defs, selectedNpcId),
    );
    setSaveStatus({ state: "idle", message: "" });
  }

  async function saveSelectedPresence(): Promise<void> {
    if (!selectedPresence) {
      return;
    }
    if (!selectedPresenceHasUnsavedChanges) {
      setSaveStatus({ state: "idle", message: "" });
      return;
    }
    if (
      draftHasBlockingErrors(draftSnapshot, validationContext) ||
      validateNpcPresenceDef(selectedPresence, validationContext).length > 0
    ) {
      setSaveStatus({
        state: "error",
        message: "Resolve errors before saving.",
      });
      return;
    }

    const content = serializePresenceDef(selectedPresence);
    setSaveStatus({ state: "saving", message: "Saving..." });
    const result = await saveEditorContent(
      presenceContentPath(selectedPresence.npcId),
      content,
    );
    if (!result.ok) {
      setSaveStatus({ state: "error", message: result.error });
      return;
    }

    setSavedPresence((defs) => upsertPresenceDef(defs, selectedPresence));
    setSaveStatus({ state: "saved", message: `Saved ${result.path}.` });
  }

  async function deleteSelectedPresence(): Promise<void> {
    if (!selectedPresence || !canDeleteSelectedPresence) {
      return;
    }
    if (selectedPresenceReferences.length > 0) {
      setSaveStatus({
        state: "error",
        message: `Presence "${selectedPresence.npcId}" is still referenced.`,
      });
      return;
    }

    const savedDef = savedPresence.find(
      (def) => def.npcId === selectedPresence.npcId,
    );
    if (!savedDef) {
      setDraftPresence((defs) =>
        removePresenceDef(defs, selectedPresence.npcId),
      );
      setSaveStatus({ state: "idle", message: "" });
      return;
    }

    setSaveStatus({ state: "saving", message: "Deleting..." });
    const result = await deleteEditorContent(
      presenceContentPath(selectedPresence.npcId),
    );
    if (!result.ok) {
      setSaveStatus({ state: "error", message: result.error });
      return;
    }

    setDraftPresence((defs) => removePresenceDef(defs, selectedPresence.npcId));
    setSavedPresence((defs) => removePresenceDef(defs, selectedPresence.npcId));
    setSaveStatus({ state: "saved", message: `Deleted ${result.path}.` });
  }

  return {
    npcs: npcEntries,
    selectedNpcId,
    selectedNpc,
    selectedPresence,
    zoneIds,
    dialogueIds,
    diagnostics,
    selectedPresenceDiagnostics,
    selectedPresenceReferences,
    errorCount,
    warningCount,
    hasUnsavedChanges,
    selectedPresenceHasUnsavedChanges,
    canCreateSelectedPresence,
    canSaveSelectedPresence,
    canResetSelectedPresence,
    canDeleteSelectedPresence,
    isSaving,
    saveStatus: displayStatus,
    selectNpc,
    createSelectedPresence,
    addScheduleEntry,
    updateScheduleEntry,
    removeScheduleEntry,
    resetSelectedPresence,
    saveSelectedPresence,
    deleteSelectedPresence,
  };
}

function firstNpcId(npcs: readonly NpcDef[]): string {
  return (
    [...npcs].sort((a, b) => a.npcId.localeCompare(b.npcId))[0]?.npcId ?? ""
  );
}

function hasAnyUnsavedPresence(
  draftPresence: readonly NpcPresenceDef[],
  savedPresence: readonly NpcPresenceDef[],
): boolean {
  const draftJsonById = serializePresenceDefsById(draftPresence);
  const savedJsonById = serializePresenceDefsById(savedPresence);
  const allIds = new Set([
    ...draftJsonById.keys(),
    ...savedJsonById.keys(),
  ]);

  for (const npcId of allIds) {
    if (draftJsonById.get(npcId) !== savedJsonById.get(npcId)) {
      return true;
    }
  }

  return false;
}

function hasSelectedPresenceUnsavedState(
  npcId: string,
  draftPresence: readonly NpcPresenceDef[],
  savedPresence: readonly NpcPresenceDef[],
): boolean {
  const draftDef = draftPresence.find((def) => def.npcId === npcId);
  const savedDef = savedPresence.find((def) => def.npcId === npcId);
  const draftJson = draftDef ? serializePresenceDef(draftDef) : undefined;
  const savedJson = savedDef ? serializePresenceDef(savedDef) : undefined;
  return draftJson !== savedJson;
}
