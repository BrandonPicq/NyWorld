import { useDeferredValue, useMemo, useState } from "react";
import {
  buildContentReferenceGraph,
  createRuntimeContentValidationContext,
  validateAllContent,
  type CombatActionDef,
  type ContentCatalogSnapshot,
  type EnemyDef,
  type GameContentConfig,
  type ItemDefMap,
  type NpcDef,
  type NpcPresenceDef,
  type QuestDef,
} from "../../engine";
import type { GridCell } from "../../rendering/canvasCellMapping";
import {
  createCombinedDraftSnapshot,
  createCombinedDraftValidationContext,
  type EditorDraftContents,
} from "./combinedDraftModel";
import type { CombinedDraftView } from "./editorDraftTypes";
import {
  hasAnyUnsavedEditorChanges,
  serializeGameConfig,
  serializeItemCatalog,
} from "./editorModel";
import {
  createActionDraftState,
  useActionDraft,
  type ActionDraftController,
} from "./actions/useActionDraft";
import {
  createDialogueDraftState,
  useDialogueDraft,
  type DialogueDraftController,
  type DialogueFilesState,
} from "./dialogues/useDialogueDraft";
import {
  createEnemyDraftState,
  useEnemyDraft,
  type EnemyDraftController,
} from "./enemies/useEnemyDraft";
import { cloneNpcDefs } from "./npcs/npcEditorModel";
import { useNpcDraft, type NpcDraftController } from "./npcs/useNpcDraft";
import {
  createPresenceDraftState,
  useNpcPresenceDraft,
  type NpcPresenceDraftController,
} from "./presence/useNpcPresenceDraft";
import {
  createQuestDraftState,
  useQuestDraft,
  type QuestDraftController,
} from "./quests/useQuestDraft";
import {
  createGameConfigDraftState,
  useGameConfigDraft,
  type GameConfigController,
} from "./useGameConfigDraft";
import {
  createItemDraftState,
  useItemDraft,
  type ItemDraftController,
} from "./useItemDraft";
import {
  activeZoneDrafts,
  useZoneDraft,
  type ZoneDraftController,
  type ZoneHistory,
} from "./zone/useZoneDraft";
import { serializeZoneData } from "./zone/zoneEditorModel";

export interface EditorUnsavedChanges {
  item: boolean;
  dialogue: boolean;
  npc: boolean;
  presence: boolean;
  enemy: boolean;
  action: boolean;
  quest: boolean;
  zone: boolean;
  game: boolean;
}

export interface EditorDrafts {
  item: ItemDraftController;
  dialogue: DialogueDraftController;
  npc: NpcDraftController;
  presence: NpcPresenceDraftController;
  enemy: EnemyDraftController;
  action: ActionDraftController;
  quest: QuestDraftController;
  zone: ZoneDraftController;
  game: GameConfigController;
  combined: CombinedDraftView;
  unsavedChanges: EditorUnsavedChanges;
  hasAnyUnsavedChanges: boolean;
}

/**
 * Owns every editor family's draft state and derives ONE combined snapshot,
 * context, diagnostics, and reference graph shared by all tabs.
 *
 * Each family hook receives its lifted state slot plus this combined view, so a
 * tab's validation and reference graph see cross-tab unsaved edits. The dialogue
 * draft is shared between the Dialogues and NPCs tabs.
 */
export function useEditorDrafts(base: ContentCatalogSnapshot): EditorDrafts {
  const baseContext = useMemo(
    () => createRuntimeContentValidationContext(),
    [],
  );

  const [draftItems, setDraftItems] = useState<ItemDefMap>(() =>
    createItemDraftState(base),
  );
  const [savedItemsJson, setSavedItemsJson] = useState(() =>
    serializeItemCatalog(base.items),
  );
  const [draftFiles, setDraftFiles] = useState<DialogueFilesState>(() =>
    createDialogueDraftState(base),
  );
  const [savedFiles, setSavedFiles] = useState<DialogueFilesState>(() =>
    createDialogueDraftState(base),
  );
  const [draftNpcs, setDraftNpcs] = useState<NpcDef[]>(() =>
    cloneNpcDefs(base.npcs),
  );
  const [savedNpcs, setSavedNpcs] = useState<NpcDef[]>(() =>
    cloneNpcDefs(base.npcs),
  );
  const [draftPresence, setDraftPresence] = useState<NpcPresenceDef[]>(() =>
    createPresenceDraftState(base),
  );
  const [savedPresence, setSavedPresence] = useState<NpcPresenceDef[]>(() =>
    createPresenceDraftState(base),
  );
  const [draftEnemies, setDraftEnemies] = useState<EnemyDef[]>(() =>
    createEnemyDraftState(base),
  );
  const [savedEnemies, setSavedEnemies] = useState<EnemyDef[]>(() =>
    createEnemyDraftState(base),
  );
  const [draftActions, setDraftActions] = useState<CombatActionDef[]>(() =>
    createActionDraftState(base),
  );
  const [savedActions, setSavedActions] = useState<CombatActionDef[]>(() =>
    createActionDraftState(base),
  );
  const [draftQuests, setDraftQuests] = useState<QuestDef[]>(() =>
    createQuestDraftState(base),
  );
  const [savedQuests, setSavedQuests] = useState<QuestDef[]>(() =>
    createQuestDraftState(base),
  );
  const [gameDraft, setGameDraft] = useState<GameContentConfig>(() =>
    createGameConfigDraftState(base),
  );
  const [savedGameJson, setSavedGameJson] = useState(() =>
    serializeGameConfig(base.game),
  );
  const [zoneHistories, setZoneHistories] = useState<
    Record<string, ZoneHistory>
  >({});
  const [savedZoneJson, setSavedZoneJson] = useState<Record<string, string>>(
    {},
  );
  const [selectedZoneId, setSelectedZoneId] = useState(
    () => Object.keys(base.zones).sort((a, b) => a.localeCompare(b))[0] ?? "",
  );
  const [pinnedInspectCell, setPinnedInspectCell] = useState<GridCell | null>(
    null,
  );

  const contents = useMemo<EditorDraftContents>(
    () => ({
      dialogueFiles: draftFiles,
      npcs: draftNpcs,
      presence: draftPresence,
      enemies: draftEnemies,
      items: draftItems,
      actions: draftActions,
      quests: draftQuests,
      game: gameDraft,
      zones: activeZoneDrafts(zoneHistories),
    }),
    [
      draftFiles,
      draftNpcs,
      draftPresence,
      draftEnemies,
      draftItems,
      draftActions,
      draftQuests,
      gameDraft,
      zoneHistories,
    ],
  );

  const combinedSnapshot = useMemo(
    () => createCombinedDraftSnapshot(base, contents),
    [base, contents],
  );
  const combinedContext = useMemo(
    () => createCombinedDraftValidationContext(baseContext, base, contents),
    [baseContext, base, contents],
  );

  // Defer the whole-bundle validation and reference graph off the typing path.
  // The live `combinedSnapshot`/`combinedContext` stay available so saves and
  // deletes re-check the truth synchronously rather than a deferred tick.
  const deferredContents = useDeferredValue(contents);
  const deferredSnapshot = useMemo(
    () => createCombinedDraftSnapshot(base, deferredContents),
    [base, deferredContents],
  );
  const diagnostics = useMemo(
    () =>
      validateAllContent(
        deferredSnapshot,
        createCombinedDraftValidationContext(baseContext, base, deferredContents),
      ),
    [base, baseContext, deferredContents, deferredSnapshot],
  );
  const graph = useMemo(
    () => buildContentReferenceGraph(deferredSnapshot),
    [deferredSnapshot],
  );
  const errorCount = diagnostics.filter(
    (diagnostic) => diagnostic.severity === "error",
  ).length;

  const combined: CombinedDraftView = {
    snapshot: combinedSnapshot,
    context: combinedContext,
    diagnostics,
    graph,
    errorCount,
    warningCount: diagnostics.length - errorCount,
  };

  const dialogueSlot = {
    draft: { value: draftFiles, set: setDraftFiles },
    saved: { value: savedFiles, set: setSavedFiles },
  };

  const item = useItemDraft(
    base,
    {
      draft: { value: draftItems, set: setDraftItems },
      savedJson: { value: savedItemsJson, set: setSavedItemsJson },
    },
    combined,
  );
  const dialogue = useDialogueDraft(base, dialogueSlot, combined);
  const npc = useNpcDraft(
    base,
    {
      npcs: { value: draftNpcs, set: setDraftNpcs },
      savedNpcs: { value: savedNpcs, set: setSavedNpcs },
      dialogue: dialogueSlot,
    },
    combined,
  );
  const presence = useNpcPresenceDraft(
    base,
    {
      draft: { value: draftPresence, set: setDraftPresence },
      saved: { value: savedPresence, set: setSavedPresence },
    },
    combined,
  );
  const enemy = useEnemyDraft(
    base,
    {
      draft: { value: draftEnemies, set: setDraftEnemies },
      saved: { value: savedEnemies, set: setSavedEnemies },
    },
    combined,
  );
  const action = useActionDraft(
    {
      draft: { value: draftActions, set: setDraftActions },
      saved: { value: savedActions, set: setSavedActions },
    },
    combined,
  );
  const quest = useQuestDraft(
    {
      draft: { value: draftQuests, set: setDraftQuests },
      saved: { value: savedQuests, set: setSavedQuests },
    },
    combined,
  );
  const zone = useZoneDraft(
    base,
    {
      selectedZoneId,
      setSelectedZoneId,
      pinnedInspectCell,
      setPinnedInspectCell,
      histories: { value: zoneHistories, set: setZoneHistories },
      savedJson: { value: savedZoneJson, set: setSavedZoneJson },
    },
    combined,
  );
  const game = useGameConfigDraft(
    base,
    {
      draft: { value: gameDraft, set: setGameDraft },
      savedJson: { value: savedGameJson, set: setSavedGameJson },
    },
    combined,
  );
  const unsavedChanges: EditorUnsavedChanges = {
    item: item.hasUnsavedChanges,
    dialogue: dialogue.hasUnsavedChanges,
    npc: npc.hasUnsavedChanges,
    presence: presence.hasUnsavedChanges,
    enemy: enemy.hasUnsavedChanges,
    action: action.hasUnsavedChanges,
    quest: quest.hasUnsavedChanges,
    zone: hasAnyUnsavedZoneDraft(base, zoneHistories, savedZoneJson),
    game: game.hasUnsavedChanges,
  };
  const hasAnyUnsavedChanges = hasAnyUnsavedEditorChanges(unsavedChanges);

  return {
    item,
    dialogue,
    npc,
    presence,
    enemy,
    action,
    quest,
    zone,
    game,
    combined,
    unsavedChanges,
    hasAnyUnsavedChanges,
  };
}

function hasAnyUnsavedZoneDraft(
  base: ContentCatalogSnapshot,
  histories: Record<string, ZoneHistory>,
  savedJson: Record<string, string>,
): boolean {
  return Object.entries(histories).some(([zoneId, history]) => {
    const baseZone = base.zones[zoneId];
    const saved =
      savedJson[zoneId] ?? (baseZone ? serializeZoneData(baseZone) : "");
    return serializeZoneData(history.present) !== saved;
  });
}
