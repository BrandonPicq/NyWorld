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
} from "../../engine";
import {
  createCombinedDraftSnapshot,
  createCombinedDraftValidationContext,
  type EditorDraftContents,
} from "./combinedDraftModel";
import type { CombinedDraftView } from "./editorDraftTypes";
import { serializeGameConfig, serializeItemCatalog } from "./editorModel";
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

export interface EditorDrafts {
  item: ItemDraftController;
  dialogue: DialogueDraftController;
  npc: NpcDraftController;
  presence: NpcPresenceDraftController;
  enemy: EnemyDraftController;
  action: ActionDraftController;
  zone: ZoneDraftController;
  game: GameConfigController;
  combined: CombinedDraftView;
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

  const contents = useMemo<EditorDraftContents>(
    () => ({
      dialogueFiles: draftFiles,
      npcs: draftNpcs,
      presence: draftPresence,
      enemies: draftEnemies,
      items: draftItems,
      actions: draftActions,
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

  // Defer the whole-bundle validation off the typing path; keep snapshot,
  // context, and reference graph live so saves and deletes re-check the truth.
  const deferredContents = useDeferredValue(contents);
  const diagnostics = useMemo(
    () =>
      validateAllContent(
        createCombinedDraftSnapshot(base, deferredContents),
        createCombinedDraftValidationContext(baseContext, base, deferredContents),
      ),
    [base, baseContext, deferredContents],
  );
  const graph = useMemo(
    () => buildContentReferenceGraph(combinedSnapshot),
    [combinedSnapshot],
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
  const zone = useZoneDraft(
    base,
    {
      selectedZoneId,
      setSelectedZoneId,
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

  return { item, dialogue, npc, presence, enemy, action, zone, game, combined };
}
