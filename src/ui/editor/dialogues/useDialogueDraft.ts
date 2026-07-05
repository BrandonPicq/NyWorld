import { useDeferredValue, useEffect, useMemo, useState } from "react";
import {
  buildContentReferenceGraph,
  CONTENT_TYPES,
  createRuntimeContentValidationContext,
  validateAllContent,
  validateDialogueFile,
  type ContentCatalogSnapshot,
  type ContentDiagnostic,
  type ContentReference,
  type DialogueDefMap,
  type DialogueNodeData,
} from "../../../engine";
import { saveEditorContent } from "../editorSaveClient";
import { draftHasBlockingErrors, type SaveStatus } from "../editorModel";
import {
  addDialogueFile,
  addDialogueToFile,
  cloneDialogueFiles,
  createDialogueDraftSnapshot,
  createDialogueDraftValidationContext,
  dialogueContentPath,
  listDialogueFiles,
  removeDialogueFromFile,
  replaceDialogueNodes,
  serializeDialogueFile,
  suggestDialogueId,
  validateNewDialogueFileStem,
  validateNewDialogueId,
  type EditorDialogueFileEntry,
} from "./dialogueEditorModel";

export interface DialogueFileListEntry extends EditorDialogueFileEntry {
  hasUnsavedChanges: boolean;
}

export interface DialogueDraftController {
  files: DialogueFileListEntry[];
  selectedStem: string;
  selectedFile: DialogueDefMap | null;
  selectedDialogueId: string;
  selectedDialogueNodes: DialogueNodeData[];
  dialogueIds: string[];
  diagnostics: ContentDiagnostic[];
  selectedFileDiagnostics: ContentDiagnostic[];
  selectedDialogueDiagnostics: ContentDiagnostic[];
  selectedDialogueReferences: ContentReference[];
  errorCount: number;
  warningCount: number;
  hasUnsavedChanges: boolean;
  selectedFileHasUnsavedChanges: boolean;
  canSaveSelectedFile: boolean;
  canDeleteSelectedDialogue: boolean;
  isSaving: boolean;
  saveStatus: SaveStatus;
  newFileStemDraft: string;
  newFileStemErrors: string[];
  newDialogueIdDraft: string;
  newDialogueIdErrors: string[];
  selectFile: (stem: string) => void;
  selectDialogue: (dialogueId: string) => void;
  setNewFileStemDraft: (stem: string) => void;
  setNewDialogueIdDraft: (dialogueId: string) => void;
  createDialogueFile: () => void;
  addDialogueToSelectedFile: () => void;
  updateSelectedDialogueNodes: (
    updater: (nodes: DialogueNodeData[]) => DialogueNodeData[],
  ) => void;
  deleteSelectedDialogue: () => void;
  resetSelectedFile: () => void;
  saveSelectedFile: () => Promise<void>;
}

export function useDialogueDraft(
  baseSnapshot: ContentCatalogSnapshot,
): DialogueDraftController {
  const baseValidationContext = useMemo(
    () => createRuntimeContentValidationContext(),
    [],
  );
  const [draftFiles, setDraftFiles] = useState(() =>
    cloneDialogueFiles(baseSnapshot.dialogueFiles),
  );
  const [savedFiles, setSavedFiles] = useState(() =>
    cloneDialogueFiles(baseSnapshot.dialogueFiles),
  );
  const firstStem = Object.keys(baseSnapshot.dialogueFiles).sort((a, b) =>
    a.localeCompare(b),
  )[0] ?? "";
  const [selectedStem, setSelectedStem] = useState(firstStem);
  const [selectedDialogueId, setSelectedDialogueId] = useState(
    firstDialogueId(baseSnapshot.dialogueFiles[firstStem]),
  );
  const [newFileStemDraft, setNewFileStemDraft] = useState("");
  const [newDialogueIdDraft, setNewDialogueIdDraft] = useState(
    firstStem ? suggestDialogueId(firstStem) : "",
  );
  const [saveStatus, setSaveStatus] = useState<SaveStatus>({
    state: "idle",
    message: "No changes.",
  });

  const draftSnapshot = useMemo(
    () => createDialogueDraftSnapshot(baseSnapshot, draftFiles),
    [baseSnapshot, draftFiles],
  );
  // Defer whole-bundle validation off the typing path; graph and save stay live.
  const deferredDraftFiles = useDeferredValue(draftFiles);
  const diagnostics = useMemo(
    () =>
      validateAllContent(
        createDialogueDraftSnapshot(baseSnapshot, deferredDraftFiles),
        createDialogueDraftValidationContext(
          baseValidationContext,
          baseSnapshot,
          deferredDraftFiles,
        ),
      ),
    [baseSnapshot, baseValidationContext, deferredDraftFiles],
  );
  const graph = useMemo(
    () => buildContentReferenceGraph(draftSnapshot),
    [draftSnapshot],
  );
  const fileEntries = useMemo(() => {
    const savedJsonByStem = serializeFiles(savedFiles);
    return listDialogueFiles(draftFiles).map((entry) => ({
      ...entry,
      hasUnsavedChanges:
        serializeDialogueFile(draftFiles[entry.stem]) !==
        savedJsonByStem.get(entry.stem),
    }));
  }, [draftFiles, savedFiles]);

  const selectedFile = draftFiles[selectedStem] ?? null;
  const dialogueIds = selectedFile
    ? Object.keys(selectedFile).sort((a, b) => a.localeCompare(b))
    : [];
  const selectedDialogueNodes =
    selectedFile && selectedDialogueId
      ? (selectedFile[selectedDialogueId] ?? [])
      : [];
  const selectedFileDiagnostics = selectedFile
    ? diagnostics.filter(
        (diagnostic) =>
          diagnostic.contentType === CONTENT_TYPES.dialogue &&
          (!diagnostic.contentId || selectedFile[diagnostic.contentId]),
      )
    : [];
  const selectedDialogueDiagnostics = selectedDialogueId
    ? selectedFileDiagnostics.filter(
        (diagnostic) => diagnostic.contentId === selectedDialogueId,
      )
    : [];
  const selectedDialogueReferences = selectedDialogueId
    ? graph.getReferencesTo({
        type: CONTENT_TYPES.dialogue,
        id: selectedDialogueId,
      })
    : [];
  const errorCount = diagnostics.filter(
    (diagnostic) => diagnostic.severity === "error",
  ).length;
  const warningCount = diagnostics.length - errorCount;
  const hasUnsavedChanges = hasAnyUnsavedFile(draftFiles, savedFiles);
  const selectedFileHasUnsavedChanges =
    selectedFile !== null &&
    serializeDialogueFile(selectedFile) !==
      serializeFiles(savedFiles).get(selectedStem);
  const isSaving = saveStatus.state === "saving";
  const canSaveSelectedFile =
    selectedFile !== null &&
    selectedFileHasUnsavedChanges &&
    errorCount === 0 &&
    !isSaving;
  const canDeleteSelectedDialogue =
    selectedFile !== null &&
    Boolean(selectedDialogueId) &&
    selectedDialogueReferences.length === 0;
  const newFileStemErrors = validateNewDialogueFileStem(
    newFileStemDraft,
    draftFiles,
  );
  const newDialogueIdErrors = validateNewDialogueId(
    newDialogueIdDraft,
    draftFiles,
  );
  const displayStatus: SaveStatus =
    saveStatus.state === "idle"
      ? {
          state: "idle",
          message: hasUnsavedChanges ? "Unsaved changes." : "No changes.",
        }
      : saveStatus;

  useEffect(() => {
    if (selectedStem && draftFiles[selectedStem]) {
      return;
    }
    const nextStem = Object.keys(draftFiles).sort((a, b) =>
      a.localeCompare(b),
    )[0] ?? "";
    setSelectedStem(nextStem);
    setSelectedDialogueId(firstDialogueId(draftFiles[nextStem]));
    setNewDialogueIdDraft(nextStem ? suggestDialogueId(nextStem) : "");
  }, [draftFiles, selectedStem]);

  useEffect(() => {
    if (!selectedFile) {
      if (selectedDialogueId) {
        setSelectedDialogueId("");
      }
      return;
    }
    if (!selectedDialogueId || !selectedFile[selectedDialogueId]) {
      setSelectedDialogueId(firstDialogueId(selectedFile));
    }
  }, [selectedDialogueId, selectedFile]);

  function selectFile(stem: string): void {
    setSelectedStem(stem);
    setSelectedDialogueId(firstDialogueId(draftFiles[stem]));
    setNewDialogueIdDraft(suggestDialogueId(stem));
  }

  function selectDialogue(dialogueId: string): void {
    setSelectedDialogueId(dialogueId);
  }

  function markEditing(): void {
    setSaveStatus((prev) =>
      prev.state === "idle" ? prev : { state: "idle", message: "" },
    );
  }

  function createDialogueFile(): void {
    const errors = validateNewDialogueFileStem(newFileStemDraft, draftFiles);
    if (errors.length > 0) {
      setSaveStatus({ state: "error", message: errors[0] });
      return;
    }

    const stem = newFileStemDraft.trim();
    setDraftFiles((files) => addDialogueFile(files, stem));
    setSelectedStem(stem);
    setSelectedDialogueId("");
    setNewFileStemDraft("");
    setNewDialogueIdDraft(suggestDialogueId(stem));
    markEditing();
  }

  function addDialogueToSelectedFile(): void {
    if (!selectedFile) {
      return;
    }
    const errors = validateNewDialogueId(newDialogueIdDraft, draftFiles);
    if (errors.length > 0) {
      setSaveStatus({ state: "error", message: errors[0] });
      return;
    }

    const dialogueId = newDialogueIdDraft.trim();
    setDraftFiles((files) =>
      addDialogueToFile(files, selectedStem, dialogueId),
    );
    setSelectedDialogueId(dialogueId);
    setNewDialogueIdDraft("");
    markEditing();
  }

  function updateSelectedDialogueNodes(
    updater: (nodes: DialogueNodeData[]) => DialogueNodeData[],
  ): void {
    if (!selectedFile || !selectedDialogueId) {
      return;
    }
    setDraftFiles((files) => {
      const currentNodes = files[selectedStem]?.[selectedDialogueId];
      if (!currentNodes) {
        return files;
      }
      return replaceDialogueNodes(
        files,
        selectedStem,
        selectedDialogueId,
        updater(currentNodes.map((node) => ({ ...node }))),
      );
    });
    markEditing();
  }

  function deleteSelectedDialogue(): void {
    if (!selectedFile || !selectedDialogueId) {
      return;
    }
    if (selectedDialogueReferences.length > 0) {
      setSaveStatus({
        state: "error",
        message: `Dialogue "${selectedDialogueId}" is still referenced.`,
      });
      return;
    }

    const nextDialogueId = nextDialogueAfterDelete(
      selectedFile,
      selectedDialogueId,
    );
    setDraftFiles((files) =>
      removeDialogueFromFile(files, selectedStem, selectedDialogueId),
    );
    setSelectedDialogueId(nextDialogueId);
    markEditing();
  }

  function resetSelectedFile(): void {
    if (!selectedStem) {
      return;
    }

    setDraftFiles((files) => {
      const next = { ...files };
      const savedFile = savedFiles[selectedStem];
      if (savedFile) {
        next[selectedStem] = cloneDialogueFile(savedFile);
      } else {
        delete next[selectedStem];
      }
      return next;
    });
    setSelectedDialogueId(firstDialogueId(savedFiles[selectedStem]));
    setSaveStatus({ state: "idle", message: "" });
  }

  async function saveSelectedFile(): Promise<void> {
    if (!selectedFile || !selectedStem) {
      return;
    }
    if (!selectedFileHasUnsavedChanges) {
      setSaveStatus({ state: "idle", message: "" });
      return;
    }
    if (
      draftHasBlockingErrors(
        draftSnapshot,
        createDialogueDraftValidationContext(
          baseValidationContext,
          baseSnapshot,
          draftFiles,
        ),
      ) ||
      validateDialogueFile(selectedFile).length > 0
    ) {
      setSaveStatus({
        state: "error",
        message: "Resolve errors before saving.",
      });
      return;
    }

    const content = serializeDialogueFile(selectedFile);
    setSaveStatus({ state: "saving", message: "Saving..." });
    const result = await saveEditorContent(
      dialogueContentPath(selectedStem),
      content,
    );
    if (!result.ok) {
      setSaveStatus({ state: "error", message: result.error });
      return;
    }

    setSavedFiles((files) => ({
      ...files,
      [selectedStem]: cloneDialogueFile(selectedFile),
    }));
    setSaveStatus({ state: "saved", message: `Saved ${result.path}.` });
  }

  return {
    files: fileEntries,
    selectedStem,
    selectedFile,
    selectedDialogueId,
    selectedDialogueNodes,
    dialogueIds,
    diagnostics,
    selectedFileDiagnostics,
    selectedDialogueDiagnostics,
    selectedDialogueReferences,
    errorCount,
    warningCount,
    hasUnsavedChanges,
    selectedFileHasUnsavedChanges,
    canSaveSelectedFile,
    canDeleteSelectedDialogue,
    isSaving,
    saveStatus: displayStatus,
    newFileStemDraft,
    newFileStemErrors,
    newDialogueIdDraft,
    newDialogueIdErrors,
    selectFile,
    selectDialogue,
    setNewFileStemDraft,
    setNewDialogueIdDraft,
    createDialogueFile,
    addDialogueToSelectedFile,
    updateSelectedDialogueNodes,
    deleteSelectedDialogue,
    resetSelectedFile,
    saveSelectedFile,
  };
}

function firstDialogueId(file: DialogueDefMap | undefined): string {
  return file
    ? (Object.keys(file).sort((a, b) => a.localeCompare(b))[0] ?? "")
    : "";
}

function serializeFiles(
  files: Record<string, DialogueDefMap>,
): Map<string, string> {
  return new Map(
    Object.entries(files).map(([stem, file]) => [
      stem,
      serializeDialogueFile(file),
    ]),
  );
}

function hasAnyUnsavedFile(
  draftFiles: Record<string, DialogueDefMap>,
  savedFiles: Record<string, DialogueDefMap>,
): boolean {
  const savedJson = serializeFiles(savedFiles);
  const allStems = new Set([
    ...Object.keys(draftFiles),
    ...Object.keys(savedFiles),
  ]);
  for (const stem of allStems) {
    const draft = draftFiles[stem];
    const saved = savedJson.get(stem);
    if (!draft || serializeDialogueFile(draft) !== saved) {
      return true;
    }
  }
  return false;
}

function cloneDialogueFile(file: DialogueDefMap): DialogueDefMap {
  return cloneDialogueFiles({ file }).file;
}

function nextDialogueAfterDelete(
  file: DialogueDefMap,
  dialogueId: string,
): string {
  const remaining = Object.keys(file)
    .filter((id) => id !== dialogueId)
    .sort((a, b) => a.localeCompare(b));
  return remaining[0] ?? "";
}
