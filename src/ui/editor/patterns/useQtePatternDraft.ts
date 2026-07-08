import { useEffect, useMemo, useState } from "react";
import {
  buildContentReferenceGraph,
  CONTENT_TYPES,
  validateQtePatternDef,
  type ContentCatalogSnapshot,
  type ContentDiagnostic,
  type ContentReference,
  type PatternDef,
} from "../../../engine";
import { deleteEditorContent, saveEditorContent } from "../editorSaveClient";
import { draftHasBlockingErrors, type SaveStatus } from "../editorModel";
import type { CombinedDraftView, DraftSlot } from "../editorDraftTypes";
import {
  clonePatternDefs,
  createDefaultPatternDef,
  isValidNewPatternId,
  listPatternEntries,
  patternContentPath,
  removePatternDef,
  serializePatternDef,
  serializePatternDefsById,
  updatePatternDef,
  upsertPatternDef,
  type EditorPatternEntry,
} from "./patternEditorModel";

export interface QtePatternDraftSlot {
  draft: DraftSlot<PatternDef[]>;
  saved: DraftSlot<PatternDef[]>;
}

export function createQtePatternDraftState(
  base: ContentCatalogSnapshot,
): PatternDef[] {
  return clonePatternDefs(base.qtePatterns ?? []);
}

export interface PatternListEntry extends EditorPatternEntry {
  hasUnsavedChanges: boolean;
}

export interface QtePatternDraftController {
  patterns: PatternListEntry[];
  selectedPatternId: string;
  selectedPattern: PatternDef | null;
  patternIds: string[];
  selectedPatternDiagnostics: ContentDiagnostic[];
  selectedPatternReferences: ContentReference[];
  errorCount: number;
  warningCount: number;
  hasUnsavedChanges: boolean;
  selectedPatternHasUnsavedChanges: boolean;
  canSaveSelectedPattern: boolean;
  canResetSelectedPattern: boolean;
  canDeleteSelectedPattern: boolean;
  isSaving: boolean;
  saveStatus: SaveStatus;
  selectPattern: (patternId: string) => void;
  canCreatePattern: (patternId: string) => boolean;
  createPattern: (patternId: string) => void;
  updateSelectedPattern: (updater: (pattern: PatternDef) => PatternDef) => void;
  resetSelectedPattern: () => void;
  saveSelectedPattern: () => Promise<void>;
  deleteSelectedPattern: () => Promise<void>;
}

export function useQtePatternDraft(
  slot: QtePatternDraftSlot,
  combined: CombinedDraftView,
): QtePatternDraftController {
  const draftPatterns = slot.draft.value;
  const setDraftPatterns = slot.draft.set;
  const savedPatterns = slot.saved.value;
  const setSavedPatterns = slot.saved.set;

  const [selectedPatternId, setSelectedPatternId] = useState(
    firstPatternId(draftPatterns),
  );
  const [saveStatus, setSaveStatus] = useState<SaveStatus>({
    state: "idle",
    message: "No changes.",
  });

  const savedJsonById = useMemo(
    () => serializePatternDefsById(savedPatterns),
    [savedPatterns],
  );
  const patternEntries = useMemo(
    () =>
      listPatternEntries(draftPatterns).map((entry) => {
        const draftPattern = draftPatterns.find(
          (pattern) => pattern.patternId === entry.id,
        );
        return {
          ...entry,
          hasUnsavedChanges:
            (draftPattern ? serializePatternDef(draftPattern) : undefined) !==
            savedJsonById.get(entry.id),
        };
      }),
    [draftPatterns, savedJsonById],
  );
  const patternIds = useMemo(
    () => draftPatterns.map((pattern) => pattern.patternId).sort(),
    [draftPatterns],
  );

  const selectedPattern =
    draftPatterns.find((pattern) => pattern.patternId === selectedPatternId) ??
    null;
  const selectedPatternDiagnostics = selectedPatternId
    ? combined.diagnostics.filter(
        (diagnostic) =>
          diagnostic.contentType === CONTENT_TYPES.qtePattern &&
          diagnostic.contentId === selectedPatternId,
      )
    : [];
  const selectedPatternReferences = selectedPatternId
    ? combined.graph.getReferencesTo({
        type: CONTENT_TYPES.qtePattern,
        id: selectedPatternId,
      })
    : [];
  const selectedPatternHasUnsavedChanges =
    selectedPattern !== null &&
    serializePatternDef(selectedPattern) !==
      savedJsonById.get(selectedPattern.patternId);
  const hasUnsavedChanges = hasAnyUnsavedPattern(draftPatterns, savedPatterns);
  const isSaving = saveStatus.state === "saving";
  const canSaveSelectedPattern =
    selectedPattern !== null &&
    selectedPatternHasUnsavedChanges &&
    combined.errorCount === 0 &&
    !isSaving;
  const canResetSelectedPattern =
    selectedPatternId !== "" &&
    hasSelectedPatternUnsavedState(
      selectedPatternId,
      draftPatterns,
      savedPatterns,
    ) &&
    !isSaving;
  const canDeleteSelectedPattern =
    selectedPattern !== null &&
    selectedPatternReferences.length === 0 &&
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
      !selectedPatternId ||
      draftPatterns.some((pattern) => pattern.patternId === selectedPatternId)
    ) {
      return;
    }
    setSelectedPatternId(firstPatternId(draftPatterns));
  }, [draftPatterns, selectedPatternId]);

  function markEditing(): void {
    setSaveStatus((prev) =>
      prev.state === "idle" ? prev : { state: "idle", message: "" },
    );
  }

  function selectPattern(patternId: string): void {
    setSelectedPatternId(patternId);
  }

  function canCreatePattern(patternId: string): boolean {
    return isValidNewPatternId(patternId.trim(), draftPatterns) && !isSaving;
  }

  function createPattern(patternId: string): void {
    const trimmed = patternId.trim();
    if (!canCreatePattern(trimmed)) {
      return;
    }
    const pattern = createDefaultPatternDef(trimmed);
    setDraftPatterns((patterns) => upsertPatternDef(patterns, pattern));
    setSelectedPatternId(trimmed);
    markEditing();
  }

  function updateSelectedPattern(
    updater: (pattern: PatternDef) => PatternDef,
  ): void {
    if (!selectedPattern) {
      return;
    }
    setDraftPatterns((patterns) =>
      updatePatternDef(patterns, selectedPattern.patternId, updater),
    );
    markEditing();
  }

  function resetSelectedPattern(): void {
    if (!selectedPatternId) {
      return;
    }
    const savedPattern = savedPatterns.find(
      (pattern) => pattern.patternId === selectedPatternId,
    );
    setDraftPatterns((patterns) =>
      savedPattern
        ? upsertPatternDef(patterns, savedPattern)
        : removePatternDef(patterns, selectedPatternId),
    );
    setSaveStatus({ state: "idle", message: "" });
  }

  async function saveSelectedPattern(): Promise<void> {
    if (!selectedPattern) {
      return;
    }
    if (!selectedPatternHasUnsavedChanges) {
      setSaveStatus({ state: "idle", message: "" });
      return;
    }
    if (
      draftHasBlockingErrors(combined.snapshot, combined.context) ||
      validateQtePatternDef(selectedPattern, combined.context).length > 0
    ) {
      setSaveStatus({ state: "error", message: "Resolve errors before saving." });
      return;
    }

    const content = serializePatternDef(selectedPattern);
    setSaveStatus({ state: "saving", message: "Saving..." });
    const result = await saveEditorContent(
      patternContentPath(selectedPattern.patternId),
      content,
    );
    if (!result.ok) {
      setSaveStatus({ state: "error", message: result.error });
      return;
    }

    setSavedPatterns((patterns) => upsertPatternDef(patterns, selectedPattern));
    setSaveStatus({ state: "saved", message: `Saved ${result.path}.` });
  }

  async function deleteSelectedPattern(): Promise<void> {
    if (!selectedPattern || !canDeleteSelectedPattern) {
      return;
    }
    // Re-check references against a fresh graph: the shared graph is deferred.
    const freshReferences = buildContentReferenceGraph(
      combined.snapshot,
    ).getReferencesTo({
      type: CONTENT_TYPES.qtePattern,
      id: selectedPattern.patternId,
    });
    if (freshReferences.length > 0) {
      setSaveStatus({
        state: "error",
        message: `Pattern "${selectedPattern.patternId}" is still referenced.`,
      });
      return;
    }

    const savedPattern = savedPatterns.find(
      (pattern) => pattern.patternId === selectedPattern.patternId,
    );
    if (!savedPattern) {
      setDraftPatterns((patterns) =>
        removePatternDef(patterns, selectedPattern.patternId),
      );
      setSaveStatus({ state: "idle", message: "" });
      return;
    }

    setSaveStatus({ state: "saving", message: "Deleting..." });
    const result = await deleteEditorContent(
      patternContentPath(selectedPattern.patternId),
    );
    if (!result.ok) {
      setSaveStatus({ state: "error", message: result.error });
      return;
    }

    setDraftPatterns((patterns) =>
      removePatternDef(patterns, selectedPattern.patternId),
    );
    setSavedPatterns((patterns) =>
      removePatternDef(patterns, selectedPattern.patternId),
    );
    setSaveStatus({ state: "saved", message: `Deleted ${result.path}.` });
  }

  return {
    patterns: patternEntries,
    selectedPatternId,
    selectedPattern,
    patternIds,
    selectedPatternDiagnostics,
    selectedPatternReferences,
    errorCount: combined.errorCount,
    warningCount: combined.warningCount,
    hasUnsavedChanges,
    selectedPatternHasUnsavedChanges,
    canSaveSelectedPattern,
    canResetSelectedPattern,
    canDeleteSelectedPattern,
    isSaving,
    saveStatus: displayStatus,
    selectPattern,
    canCreatePattern,
    createPattern,
    updateSelectedPattern,
    resetSelectedPattern,
    saveSelectedPattern,
    deleteSelectedPattern,
  };
}

function firstPatternId(patterns: readonly PatternDef[]): string {
  return (
    [...patterns].sort((a, b) => a.patternId.localeCompare(b.patternId))[0]
      ?.patternId ?? ""
  );
}

function hasAnyUnsavedPattern(
  draftPatterns: readonly PatternDef[],
  savedPatterns: readonly PatternDef[],
): boolean {
  const draftJsonById = serializePatternDefsById(draftPatterns);
  const savedJsonById = serializePatternDefsById(savedPatterns);
  const allIds = new Set([...draftJsonById.keys(), ...savedJsonById.keys()]);
  for (const patternId of allIds) {
    if (draftJsonById.get(patternId) !== savedJsonById.get(patternId)) {
      return true;
    }
  }
  return false;
}

function hasSelectedPatternUnsavedState(
  patternId: string,
  draftPatterns: readonly PatternDef[],
  savedPatterns: readonly PatternDef[],
): boolean {
  const draftPattern = draftPatterns.find((p) => p.patternId === patternId);
  const savedPattern = savedPatterns.find((p) => p.patternId === patternId);
  const draftJson = draftPattern ? serializePatternDef(draftPattern) : undefined;
  const savedJson = savedPattern ? serializePatternDef(savedPattern) : undefined;
  return draftJson !== savedJson;
}
