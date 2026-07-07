import { useEffect, useMemo, useState } from "react";
import {
  CONTENT_TYPES,
  validateClassDef,
  type ClassDef,
  type ContentCatalogSnapshot,
  type ContentDiagnostic,
  type ContentReference,
} from "../../../engine";
import { draftHasBlockingErrors, type SaveStatus } from "../editorModel";
import { saveEditorContent } from "../editorSaveClient";
import type { CombinedDraftView, DraftSlot } from "../editorDraftTypes";
import {
  classContentPath,
  createClassDraftState,
  listClassDefs,
  serializeClassDef,
  serializeClassDefsById,
  updateClassDef,
  upsertClassDef,
  type EditorClassEntry,
} from "./classEditorModel";

export interface ClassDraftSlot {
  draft: DraftSlot<ClassDef[]>;
  saved: DraftSlot<ClassDef[]>;
}

export interface ClassListEntry extends EditorClassEntry {
  hasUnsavedChanges: boolean;
}

export interface ClassDraftController {
  classes: ClassListEntry[];
  selectedClassId: string;
  selectedClass: ClassDef | null;
  selectedClassDiagnostics: ContentDiagnostic[];
  selectedClassReferences: ContentReference[];
  errorCount: number;
  warningCount: number;
  hasUnsavedChanges: boolean;
  selectedClassHasUnsavedChanges: boolean;
  canSaveSelectedClass: boolean;
  isSaving: boolean;
  saveStatus: SaveStatus;
  selectClass: (classId: string) => void;
  updateSelectedClass: (updater: (classDef: ClassDef) => ClassDef) => void;
  resetSelectedClass: () => void;
  saveSelectedClass: () => Promise<void>;
}

export { createClassDraftState };

export function useClassDraft(
  slot: ClassDraftSlot,
  combined: CombinedDraftView,
): ClassDraftController {
  const draftClasses = slot.draft.value;
  const setDraftClasses = slot.draft.set;
  const savedClasses = slot.saved.value;
  const setSavedClasses = slot.saved.set;
  const [selectedClassId, setSelectedClassId] = useState(
    firstClassId(draftClasses),
  );
  const [saveStatus, setSaveStatus] = useState<SaveStatus>({
    state: "idle",
    message: "No changes.",
  });

  const savedClassJsonById = useMemo(
    () => serializeClassDefsById(savedClasses),
    [savedClasses],
  );
  const classEntries = useMemo(
    () =>
      listClassDefs(draftClasses).map((entry) => {
        const draftClass = draftClasses.find(
          (classDef) => classDef.classId === entry.classId,
        );
        return {
          ...entry,
          hasUnsavedChanges:
            !draftClass ||
            serializeClassDef(draftClass) !==
              savedClassJsonById.get(entry.classId),
        };
      }),
    [draftClasses, savedClassJsonById],
  );
  const selectedClass =
    draftClasses.find((classDef) => classDef.classId === selectedClassId) ??
    null;
  const selectedClassDiagnostics = selectedClassId
    ? combined.diagnostics.filter(
        (diagnostic) =>
          diagnostic.contentType === CONTENT_TYPES.class &&
          diagnostic.contentId === selectedClassId,
      )
    : [];
  const selectedClassReferences = selectedClassId
    ? combined.graph.getReferencesTo({
        type: CONTENT_TYPES.class,
        id: selectedClassId,
      })
    : [];
  const selectedClassHasUnsavedChanges =
    selectedClass !== null &&
    serializeClassDef(selectedClass) !==
      savedClassJsonById.get(selectedClass.classId);
  const hasUnsavedChanges = classEntries.some(
    (entry) => entry.hasUnsavedChanges,
  );
  const isSaving = saveStatus.state === "saving";
  const canSaveSelectedClass =
    selectedClass !== null &&
    selectedClassHasUnsavedChanges &&
    combined.errorCount === 0 &&
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
      !selectedClassId ||
      draftClasses.some((classDef) => classDef.classId === selectedClassId)
    ) {
      return;
    }
    setSelectedClassId(firstClassId(draftClasses));
  }, [draftClasses, selectedClassId]);

  function selectClass(classId: string): void {
    setSelectedClassId(classId);
  }

  function markEditing(): void {
    setSaveStatus((prev) =>
      prev.state === "idle" ? prev : { state: "idle", message: "" },
    );
  }

  function updateSelectedClass(updater: (classDef: ClassDef) => ClassDef): void {
    if (!selectedClassId) return;
    setDraftClasses((classes) =>
      updateClassDef(classes, selectedClassId, updater),
    );
    markEditing();
  }

  function resetSelectedClass(): void {
    if (!selectedClassId) return;
    const savedClass = savedClasses.find(
      (classDef) => classDef.classId === selectedClassId,
    );
    if (savedClass) {
      setDraftClasses((classes) => upsertClassDef(classes, savedClass));
    }
    setSaveStatus({ state: "idle", message: "" });
  }

  async function saveSelectedClass(): Promise<void> {
    if (!selectedClass) return;
    if (!selectedClassHasUnsavedChanges) {
      setSaveStatus({ state: "idle", message: "" });
      return;
    }
    if (
      draftHasBlockingErrors(combined.snapshot, combined.context) ||
      validateClassDef(selectedClass).some(
        (diagnostic) => diagnostic.severity === "error",
      )
    ) {
      setSaveStatus({
        state: "error",
        message: "Resolve errors before saving.",
      });
      return;
    }

    setSaveStatus({ state: "saving", message: "Saving..." });
    const result = await saveEditorContent(
      classContentPath(selectedClass.classId),
      serializeClassDef(selectedClass),
    );
    if (!result.ok) {
      setSaveStatus({ state: "error", message: result.error });
      return;
    }

    setSavedClasses((classes) => upsertClassDef(classes, selectedClass));
    setSaveStatus({ state: "saved", message: `Saved ${result.path}.` });
  }

  return {
    classes: classEntries,
    selectedClassId,
    selectedClass,
    selectedClassDiagnostics,
    selectedClassReferences,
    errorCount: combined.errorCount,
    warningCount: combined.warningCount,
    hasUnsavedChanges,
    selectedClassHasUnsavedChanges,
    canSaveSelectedClass,
    isSaving,
    saveStatus: displayStatus,
    selectClass,
    updateSelectedClass,
    resetSelectedClass,
    saveSelectedClass,
  };
}

function firstClassId(classes: readonly ClassDef[]): string {
  return (
    [...classes].sort((a, b) => a.classId.localeCompare(b.classId))[0]
      ?.classId ?? ""
  );
}
