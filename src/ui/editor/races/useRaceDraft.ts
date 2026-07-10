import { useEffect, useMemo, useState } from "react";
import {
  CONTENT_TYPES,
  validateRaceDef,
  type ContentDiagnostic,
  type ContentReference,
  type RaceDef,
} from "../../../engine";
import {
  formatFileSaveBlocker,
  getFileSaveGate,
  getFileSaveStatus,
  type SaveStatus,
} from "../editorModel";
import { saveEditorContent } from "../editorSaveClient";
import type { CombinedDraftView, DraftSlot } from "../editorDraftTypes";
import {
  createRaceDraftState,
  listRaceDefs,
  raceContentPath,
  serializeRaceDef,
  serializeRaceDefsById,
  updateRaceDef,
  upsertRaceDef,
  type EditorRaceEntry,
} from "./raceEditorModel";

export interface RaceDraftSlot {
  draft: DraftSlot<RaceDef[]>;
  saved: DraftSlot<RaceDef[]>;
}

export interface RaceListEntry extends EditorRaceEntry {
  hasUnsavedChanges: boolean;
}

export interface RaceDraftController {
  races: RaceListEntry[];
  selectedRaceId: string;
  selectedRace: RaceDef | null;
  selectedRaceDiagnostics: ContentDiagnostic[];
  selectedRaceReferences: ContentReference[];
  errorCount: number;
  warningCount: number;
  hasUnsavedChanges: boolean;
  selectedRaceHasUnsavedChanges: boolean;
  canSaveSelectedRace: boolean;
  isSaving: boolean;
  saveStatus: SaveStatus;
  selectRace: (raceId: string) => void;
  updateSelectedRace: (updater: (race: RaceDef) => RaceDef) => void;
  resetSelectedRace: () => void;
  saveSelectedRace: () => Promise<void>;
}

export { createRaceDraftState };

export function useRaceDraft(
  slot: RaceDraftSlot,
  combined: CombinedDraftView,
): RaceDraftController {
  const draftRaces = slot.draft.value;
  const setDraftRaces = slot.draft.set;
  const savedRaces = slot.saved.value;
  const setSavedRaces = slot.saved.set;
  const [selectedRaceId, setSelectedRaceId] = useState(
    firstRaceId(draftRaces),
  );
  const [saveStatus, setSaveStatus] = useState<SaveStatus>({
    state: "idle",
    message: "No changes.",
  });

  const savedRaceJsonById = useMemo(
    () => serializeRaceDefsById(savedRaces),
    [savedRaces],
  );
  const raceEntries = useMemo(
    () =>
      listRaceDefs(draftRaces).map((entry) => {
        const draftRace = draftRaces.find(
          (race) => race.raceId === entry.raceId,
        );
        return {
          ...entry,
          hasUnsavedChanges:
            !draftRace ||
            serializeRaceDef(draftRace) !== savedRaceJsonById.get(entry.raceId),
        };
      }),
    [draftRaces, savedRaceJsonById],
  );
  const selectedRace =
    draftRaces.find((race) => race.raceId === selectedRaceId) ?? null;
  const selectedRaceDiagnostics = selectedRaceId
    ? combined.diagnostics.filter(
        (diagnostic) =>
          diagnostic.contentType === CONTENT_TYPES.race &&
          diagnostic.contentId === selectedRaceId,
      )
    : [];
  const selectedRaceReferences = selectedRaceId
    ? combined.graph.getReferencesTo({
        type: CONTENT_TYPES.race,
        id: selectedRaceId,
      })
    : [];
  const selectedRaceHasUnsavedChanges =
    selectedRace !== null &&
    serializeRaceDef(selectedRace) !== savedRaceJsonById.get(selectedRace.raceId);
  const hasUnsavedChanges = raceEntries.some((entry) => entry.hasUnsavedChanges);
  const isSaving = saveStatus.state === "saving";
  const selectedRaceSaveGate = getFileSaveGate(
    selectedRace ? validateRaceDef(selectedRace) : [],
    { hasUnsavedChanges: selectedRaceHasUnsavedChanges, isSaving },
  );
  const canSaveSelectedRace =
    selectedRace !== null && selectedRaceSaveGate.canSave;
  const displayStatus = getFileSaveStatus(saveStatus, {
    hasUnsavedChanges: selectedRaceHasUnsavedChanges,
    errorCount: selectedRaceSaveGate.errorCount,
  });

  useEffect(() => {
    if (
      !selectedRaceId ||
      draftRaces.some((race) => race.raceId === selectedRaceId)
    ) {
      return;
    }
    setSelectedRaceId(firstRaceId(draftRaces));
  }, [draftRaces, selectedRaceId]);

  function selectRace(raceId: string): void {
    setSelectedRaceId(raceId);
  }

  function markEditing(): void {
    setSaveStatus((prev) =>
      prev.state === "idle" ? prev : { state: "idle", message: "" },
    );
  }

  function updateSelectedRace(updater: (race: RaceDef) => RaceDef): void {
    if (!selectedRaceId) return;
    setDraftRaces((races) => updateRaceDef(races, selectedRaceId, updater));
    markEditing();
  }

  function resetSelectedRace(): void {
    if (!selectedRaceId) return;
    const savedRace = savedRaces.find((race) => race.raceId === selectedRaceId);
    if (savedRace) {
      setDraftRaces((races) => upsertRaceDef(races, savedRace));
    }
    setSaveStatus({ state: "idle", message: "" });
  }

  async function saveSelectedRace(): Promise<void> {
    if (!selectedRace) return;
    if (!selectedRaceHasUnsavedChanges) {
      setSaveStatus({ state: "idle", message: "" });
      return;
    }
    const saveGate = getFileSaveGate(validateRaceDef(selectedRace), {
      hasUnsavedChanges: selectedRaceHasUnsavedChanges,
      isSaving,
    });
    if (saveGate.errorCount > 0) {
      setSaveStatus({
        state: "error",
        message: formatFileSaveBlocker(saveGate.errorCount),
      });
      return;
    }

    setSaveStatus({ state: "saving", message: "Saving..." });
    const result = await saveEditorContent(
      raceContentPath(selectedRace.raceId),
      serializeRaceDef(selectedRace),
    );
    if (!result.ok) {
      setSaveStatus({ state: "error", message: result.error });
      return;
    }

    setSavedRaces((races) => upsertRaceDef(races, selectedRace));
    setSaveStatus({ state: "saved", message: `Saved ${result.path}.` });
  }

  return {
    races: raceEntries,
    selectedRaceId,
    selectedRace,
    selectedRaceDiagnostics,
    selectedRaceReferences,
    errorCount: combined.errorCount,
    warningCount: combined.warningCount,
    hasUnsavedChanges,
    selectedRaceHasUnsavedChanges,
    canSaveSelectedRace,
    isSaving,
    saveStatus: displayStatus,
    selectRace,
    updateSelectedRace,
    resetSelectedRace,
    saveSelectedRace,
  };
}

function firstRaceId(races: readonly RaceDef[]): string {
  return (
    [...races].sort((a, b) => a.raceId.localeCompare(b.raceId))[0]?.raceId ??
    ""
  );
}
