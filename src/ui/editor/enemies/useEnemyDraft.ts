import { useEffect, useMemo, useState } from "react";
import {
  buildContentReferenceGraph,
  CONTENT_TYPES,
  validateEnemyDef,
  type ContentCatalogSnapshot,
  type ContentDiagnostic,
  type ContentReference,
  type EnemyDef,
  type NpcDef,
} from "../../../engine";
import { deleteEditorContent, saveEditorContent } from "../editorSaveClient";
import { draftHasBlockingErrors, type SaveStatus } from "../editorModel";
import type { CombinedDraftView, DraftSlot } from "../editorDraftTypes";
import {
  cloneEnemyDefs,
  createEnemyDefForNpc,
  enemyContentPath,
  listEnemyNpcEntries,
  removeEnemyDef,
  serializeEnemyDef,
  serializeEnemyDefsById,
  updateEnemyDef,
  upsertEnemyDef,
  type EditorEnemyNpcEntry,
} from "./enemyEditorModel";

export interface EnemyDraftSlot {
  draft: DraftSlot<EnemyDef[]>;
  saved: DraftSlot<EnemyDef[]>;
}

export function createEnemyDraftState(
  base: ContentCatalogSnapshot,
): EnemyDef[] {
  return cloneEnemyDefs(base.enemies);
}

export interface EnemyNpcListEntry extends EditorEnemyNpcEntry {
  hasUnsavedChanges: boolean;
}

export interface EnemyDraftController {
  npcs: EnemyNpcListEntry[];
  selectedNpcId: string;
  selectedNpc: NpcDef | null;
  selectedEnemy: EnemyDef | null;
  itemIds: string[];
  selectedEnemyDiagnostics: ContentDiagnostic[];
  selectedEnemyReferences: ContentReference[];
  errorCount: number;
  warningCount: number;
  hasUnsavedChanges: boolean;
  selectedEnemyHasUnsavedChanges: boolean;
  canCreateSelectedEnemy: boolean;
  canSaveSelectedEnemy: boolean;
  canResetSelectedEnemy: boolean;
  canDeleteSelectedEnemy: boolean;
  isSaving: boolean;
  saveStatus: SaveStatus;
  selectNpc: (npcId: string) => void;
  createSelectedEnemy: () => void;
  updateSelectedEnemy: (updater: (enemy: EnemyDef) => EnemyDef) => void;
  resetSelectedEnemy: () => void;
  saveSelectedEnemy: () => Promise<void>;
  deleteSelectedEnemy: () => Promise<void>;
}

export function useEnemyDraft(
  base: ContentCatalogSnapshot,
  slot: EnemyDraftSlot,
  combined: CombinedDraftView,
): EnemyDraftController {
  const draftEnemies = slot.draft.value;
  const setDraftEnemies = slot.draft.set;
  const savedEnemies = slot.saved.value;
  const setSavedEnemies = slot.saved.set;

  const [selectedNpcId, setSelectedNpcId] = useState(firstNpcId(base.npcs));
  const [saveStatus, setSaveStatus] = useState<SaveStatus>({
    state: "idle",
    message: "No changes.",
  });

  const savedEnemyJsonById = useMemo(
    () => serializeEnemyDefsById(savedEnemies),
    [savedEnemies],
  );
  const npcEntries = useMemo(
    () =>
      listEnemyNpcEntries(base.npcs, draftEnemies).map((entry) => {
        const draftEnemy = draftEnemies.find(
          (enemy) => enemy.npcId === entry.npcId,
        );
        return {
          ...entry,
          hasUnsavedChanges:
            (draftEnemy ? serializeEnemyDef(draftEnemy) : undefined) !==
            savedEnemyJsonById.get(entry.npcId),
        };
      }),
    [base.npcs, draftEnemies, savedEnemyJsonById],
  );
  const itemIds = useMemo(
    () => Object.keys(base.items).sort((a, b) => a.localeCompare(b)),
    [base.items],
  );
  const selectedNpc =
    base.npcs.find((npc) => npc.npcId === selectedNpcId) ?? null;
  const selectedEnemy =
    draftEnemies.find((enemy) => enemy.npcId === selectedNpcId) ?? null;
  const selectedEnemyDiagnostics = selectedNpcId
    ? combined.diagnostics.filter(
        (diagnostic) =>
          diagnostic.contentType === CONTENT_TYPES.enemy &&
          diagnostic.contentId === selectedNpcId,
      )
    : [];
  const selectedEnemyReferences = selectedNpcId
    ? combined.graph.getReferencesTo({
        type: CONTENT_TYPES.enemy,
        id: selectedNpcId,
      })
    : [];
  const selectedEnemyHasUnsavedChanges =
    selectedEnemy !== null &&
    serializeEnemyDef(selectedEnemy) !==
      savedEnemyJsonById.get(selectedEnemy.npcId);
  const hasUnsavedChanges = hasAnyUnsavedEnemy(draftEnemies, savedEnemies);
  const isSaving = saveStatus.state === "saving";
  const canCreateSelectedEnemy =
    selectedNpc !== null && selectedEnemy === null && !isSaving;
  const canSaveSelectedEnemy =
    selectedEnemy !== null &&
    selectedEnemyHasUnsavedChanges &&
    combined.errorCount === 0 &&
    !isSaving;
  const canResetSelectedEnemy =
    selectedNpcId !== "" &&
    hasSelectedEnemyUnsavedState(selectedNpcId, draftEnemies, savedEnemies) &&
    !isSaving;
  const canDeleteSelectedEnemy =
    selectedEnemy !== null &&
    selectedEnemyReferences.length === 0 &&
    !isSaving;
  const displayStatus: SaveStatus =
    saveStatus.state === "idle"
      ? {
          state: "idle",
          message: hasUnsavedChanges ? "Unsaved changes." : "No changes.",
        }
      : saveStatus;

  useEffect(() => {
    if (!selectedNpcId || base.npcs.some((npc) => npc.npcId === selectedNpcId)) {
      return;
    }
    setSelectedNpcId(firstNpcId(base.npcs));
  }, [base.npcs, selectedNpcId]);

  function selectNpc(npcId: string): void {
    setSelectedNpcId(npcId);
  }

  function markEditing(): void {
    setSaveStatus((prev) =>
      prev.state === "idle" ? prev : { state: "idle", message: "" },
    );
  }

  function createSelectedEnemy(): void {
    if (!canCreateSelectedEnemy || !selectedNpc) {
      return;
    }
    const enemy = createEnemyDefForNpc(selectedNpc);
    setDraftEnemies((enemies) => upsertEnemyDef(enemies, enemy));
    markEditing();
  }

  function updateSelectedEnemy(updater: (enemy: EnemyDef) => EnemyDef): void {
    if (!selectedEnemy) {
      return;
    }
    setDraftEnemies((enemies) =>
      updateEnemyDef(enemies, selectedEnemy.npcId, updater),
    );
    markEditing();
  }

  function resetSelectedEnemy(): void {
    if (!selectedNpcId) {
      return;
    }
    const savedEnemy = savedEnemies.find(
      (enemy) => enemy.npcId === selectedNpcId,
    );
    setDraftEnemies((enemies) =>
      savedEnemy
        ? upsertEnemyDef(enemies, savedEnemy)
        : removeEnemyDef(enemies, selectedNpcId),
    );
    setSaveStatus({ state: "idle", message: "" });
  }

  async function saveSelectedEnemy(): Promise<void> {
    if (!selectedEnemy) {
      return;
    }
    if (!selectedEnemyHasUnsavedChanges) {
      setSaveStatus({ state: "idle", message: "" });
      return;
    }
    if (
      draftHasBlockingErrors(combined.snapshot, combined.context) ||
      validateEnemyDef(selectedEnemy, combined.context).length > 0
    ) {
      setSaveStatus({
        state: "error",
        message: "Resolve errors before saving.",
      });
      return;
    }

    const content = serializeEnemyDef(selectedEnemy);
    setSaveStatus({ state: "saving", message: "Saving..." });
    const result = await saveEditorContent(
      enemyContentPath(selectedEnemy.npcId),
      content,
    );
    if (!result.ok) {
      setSaveStatus({ state: "error", message: result.error });
      return;
    }

    setSavedEnemies((enemies) => upsertEnemyDef(enemies, selectedEnemy));
    setSaveStatus({ state: "saved", message: `Saved ${result.path}.` });
  }

  async function deleteSelectedEnemy(): Promise<void> {
    if (!selectedEnemy || !canDeleteSelectedEnemy) {
      return;
    }
    // Re-check references against a fresh graph: the shared graph is deferred,
    // so a reference added this tick must still block the delete.
    const freshReferences = buildContentReferenceGraph(
      combined.snapshot,
    ).getReferencesTo({ type: CONTENT_TYPES.enemy, id: selectedEnemy.npcId });
    if (freshReferences.length > 0) {
      setSaveStatus({
        state: "error",
        message: `Enemy "${selectedEnemy.npcId}" is still referenced.`,
      });
      return;
    }

    const savedEnemy = savedEnemies.find(
      (enemy) => enemy.npcId === selectedEnemy.npcId,
    );
    if (!savedEnemy) {
      setDraftEnemies((enemies) => removeEnemyDef(enemies, selectedEnemy.npcId));
      setSaveStatus({ state: "idle", message: "" });
      return;
    }

    setSaveStatus({ state: "saving", message: "Deleting..." });
    const result = await deleteEditorContent(
      enemyContentPath(selectedEnemy.npcId),
    );
    if (!result.ok) {
      setSaveStatus({ state: "error", message: result.error });
      return;
    }

    setDraftEnemies((enemies) => removeEnemyDef(enemies, selectedEnemy.npcId));
    setSavedEnemies((enemies) => removeEnemyDef(enemies, selectedEnemy.npcId));
    setSaveStatus({ state: "saved", message: `Deleted ${result.path}.` });
  }

  return {
    npcs: npcEntries,
    selectedNpcId,
    selectedNpc,
    selectedEnemy,
    itemIds,
    selectedEnemyDiagnostics,
    selectedEnemyReferences,
    errorCount: combined.errorCount,
    warningCount: combined.warningCount,
    hasUnsavedChanges,
    selectedEnemyHasUnsavedChanges,
    canCreateSelectedEnemy,
    canSaveSelectedEnemy,
    canResetSelectedEnemy,
    canDeleteSelectedEnemy,
    isSaving,
    saveStatus: displayStatus,
    selectNpc,
    createSelectedEnemy,
    updateSelectedEnemy,
    resetSelectedEnemy,
    saveSelectedEnemy,
    deleteSelectedEnemy,
  };
}

function firstNpcId(npcs: readonly NpcDef[]): string {
  return (
    [...npcs].sort((a, b) => a.npcId.localeCompare(b.npcId))[0]?.npcId ?? ""
  );
}

function hasAnyUnsavedEnemy(
  draftEnemies: readonly EnemyDef[],
  savedEnemies: readonly EnemyDef[],
): boolean {
  const draftJsonById = serializeEnemyDefsById(draftEnemies);
  const savedJsonById = serializeEnemyDefsById(savedEnemies);
  const allIds = new Set([...draftJsonById.keys(), ...savedJsonById.keys()]);

  for (const npcId of allIds) {
    if (draftJsonById.get(npcId) !== savedJsonById.get(npcId)) {
      return true;
    }
  }

  return false;
}

function hasSelectedEnemyUnsavedState(
  npcId: string,
  draftEnemies: readonly EnemyDef[],
  savedEnemies: readonly EnemyDef[],
): boolean {
  const draftEnemy = draftEnemies.find((enemy) => enemy.npcId === npcId);
  const savedEnemy = savedEnemies.find((enemy) => enemy.npcId === npcId);
  const draftJson = draftEnemy ? serializeEnemyDef(draftEnemy) : undefined;
  const savedJson = savedEnemy ? serializeEnemyDef(savedEnemy) : undefined;
  return draftJson !== savedJson;
}
