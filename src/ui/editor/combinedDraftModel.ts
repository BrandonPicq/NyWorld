import type {
  CombatActionDef,
  ClassDef,
  ContentCatalogSnapshot,
  ContentValidationContext,
  DialogueDefMap,
  EnemyDef,
  EventDef,
  GameContentConfig,
  ItemDefMap,
  NpcDef,
  NpcPresenceDef,
  PatternDef,
  QuestDef,
  RaceDef,
  ZoneData,
} from "../../engine";
import {
  createPatternDraftSnapshot,
  createPatternDraftValidationContext,
} from "./patterns/patternEditorModel";
import {
  cloneClassDefs,
  createClassDraftValidationContext,
} from "./classes/classEditorModel";
import { cloneQuestDefs, createQuestDraftValidationContext } from "./quests/questEditorModel";
import {
  createActionDraftSnapshot,
} from "./actions/actionEditorModel";
import {
  createDialogueDraftSnapshot,
  createDialogueDraftValidationContext,
} from "./dialogues/dialogueEditorModel";
import {
  createItemDraftSnapshot,
  createItemDraftValidationContext,
} from "./editorModel";
import {
  createEnemyDraftSnapshot,
  createEnemyDraftValidationContext,
} from "./enemies/enemyEditorModel";
import { cloneNpcDefs } from "./npcs/npcEditorModel";
import { createPresenceDraftSnapshot } from "./presence/presenceEditorModel";
import { createEventDraftSnapshot } from "./events/eventEditorModel";
import {
  cloneRaceDefs,
  createRaceDraftValidationContext,
} from "./races/raceEditorModel";
import {
  createZoneDraftSnapshot,
  createZoneDraftValidationContext,
} from "./zone/zoneEditorModel";

/**
 * The live draft contents of every editor family, gathered in one place.
 *
 * `zones` holds every zone that has an unsaved draft; each is substituted into
 * the combined snapshot so cross-tab validation sees painted tiles.
 */
export interface EditorDraftContents {
  dialogueFiles: Record<string, DialogueDefMap>;
  npcs: readonly NpcDef[];
  presence: readonly NpcPresenceDef[];
  enemies: readonly EnemyDef[];
  items: ItemDefMap;
  actions: readonly CombatActionDef[];
  classes: readonly ClassDef[];
  races: readonly RaceDef[];
  quests: readonly QuestDef[];
  patterns: readonly PatternDef[];
  events?: readonly EventDef[];
  game: GameContentConfig;
  zones?: readonly ZoneData[];
}

/**
 * Builds one catalog snapshot reflecting every family's unsaved draft.
 *
 * It chains the per-family draft composers the way `createNpcDraftSnapshot`
 * already chains the dialogue draft, so a tab's validation and reference graph
 * see cross-tab unsaved edits rather than only its own family.
 */
export function createCombinedDraftSnapshot(
  base: ContentCatalogSnapshot,
  contents: EditorDraftContents,
): ContentCatalogSnapshot {
  let snapshot = createDialogueDraftSnapshot(base, contents.dialogueFiles);
  snapshot = { ...snapshot, npcs: cloneNpcDefs(contents.npcs) };
  snapshot = createPresenceDraftSnapshot(snapshot, contents.presence);
  snapshot = createEnemyDraftSnapshot(snapshot, contents.enemies);
  snapshot = createItemDraftSnapshot(snapshot, contents.items);
  snapshot = createActionDraftSnapshot(snapshot, contents.actions);
  snapshot = { ...snapshot, classes: cloneClassDefs(contents.classes) };
  snapshot = { ...snapshot, races: cloneRaceDefs(contents.races) };
  snapshot = { ...snapshot, quests: cloneQuestDefs(contents.quests) };
  snapshot = createPatternDraftSnapshot(snapshot, contents.patterns);
  snapshot = createEventDraftSnapshot(snapshot, contents.events ?? base.events ?? []);
  for (const zone of contents.zones ?? []) {
    snapshot = createZoneDraftSnapshot(snapshot, zone);
  }
  // Clone the game config so mutating the snapshot cannot corrupt the draft.
  snapshot = { ...snapshot, game: structuredClone(contents.game) };
  return snapshot;
}

/**
 * Builds the validation context matching `createCombinedDraftSnapshot`.
 *
 * Presence, combat actions, and game config contribute no ids, so they are
 * absent here; the zone draft substitutes its painted `GameMap` so cross-zone
 * checks run against the edit.
 */
export function createCombinedDraftValidationContext(
  baseContext: ContentValidationContext,
  base: ContentCatalogSnapshot,
  contents: EditorDraftContents,
): ContentValidationContext {
  let context = createDialogueDraftValidationContext(
    baseContext,
    base,
    contents.dialogueFiles,
  );
  context = {
    ...context,
    npcIds: new Set(contents.npcs.map((npc) => npc.npcId)),
  };
  context = createEnemyDraftValidationContext(context, contents.enemies);
  context = createItemDraftValidationContext(context, contents.items);
  context = createClassDraftValidationContext(context, contents.classes);
  context = createRaceDraftValidationContext(context, contents.races);
  context = createQuestDraftValidationContext(context, contents.quests);
  context = createPatternDraftValidationContext(context, contents.patterns);
  for (const zone of contents.zones ?? []) {
    context = createZoneDraftValidationContext(context, zone);
  }
  return context;
}
