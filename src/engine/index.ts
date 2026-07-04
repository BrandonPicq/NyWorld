export type {
  DialogueNode,
  Inventory,
  InventoryItemCategory,
  InventoryStack,
  Item,
  Npc,
  PlayerControlled,
  Position,
  Renderable,
  CharacterCondition,
  StatResources,
  Stats,
} from "./components";
export {
  cloneStats,
  createInitialStats,
  deriveCombatStats,
  deriveMaxHp,
  deriveMaxMp,
  deriveMaxSp,
  getStatValue,
  isStatPath,
  refreshDerivedStats,
} from "./stats/characterStats";
export type { StatPath, StatSection } from "./stats/characterStats";
export {
  defaultContentBundle,
  createContentBundle,
  getDefaultZoneData,
  getSafeRespawn,
  getZoneData,
  resolveZoneFromBundle,
} from "./content/contentBundle";
export type {
  ContentBundle,
  GameContentConfig,
  SafeRespawnPoint,
} from "./content/contentBundle";
export type {
  ContentDiagnostic,
  ContentDiagnosticSeverity,
} from "./content/ContentDiagnostic";
export {
  formatContentDiagnostic,
  hasContentDiagnosticErrors,
} from "./content/ContentDiagnostic";
export {
  createRuntimeContentValidationContext,
} from "./content/ContentValidationContext";
export type {
  ContentValidationContext,
} from "./content/ContentValidationContext";
export {
  createQteChallenge,
  resolveQteContest,
} from "./combat/qteCombat";
export type {
  CombatActionKind,
  QteChallenge,
  QteChallengeInput,
  QteContestInput,
  QteContestOutcome,
  QteContestResult,
} from "./combat/qteCombat";
export {
  getAllCombatActionDefs,
  getCombatActionDef,
  hasCombatActionDef,
} from "./combat/combatActionRegistry";
export type {
  CombatActionCategory,
  CombatActionDef,
  CombatActionDefMap,
  CombatActionId,
} from "./combat/CombatActionDef";
export { CombatSystem, isCombatNpc } from "./combat/CombatSystem";
export type {
  CombatEffect,
  CombatExecuteResult,
  CombatPhase,
  CombatState,
  CombatSystemContext,
} from "./combat/CombatSystem";
export {
  getAllEnemyDefs,
  getEnemyDef,
  hasEnemyDef,
  isCombatEnemy,
} from "./enemies/enemyRegistry";
export type {
  EnemyDef,
  EnemyDefMap,
  EnemyLootEntry,
  EnemyStatsData,
} from "./enemies/EnemyDef";
export { World } from "./ecs";
export type { Component, EntityId } from "./ecs";
export { GameMap } from "./GameMap";
export { getTileDef } from "./TileRegistry";
export type { TileDef } from "./TileRegistry";
export {
  ZoneLoadError,
  createGameMapFromZoneData,
  loadZone,
  validateZoneData,
} from "./zoneLoader";
export type {
  PlayerStart,
  TileGrid,
  TileId,
  ZoneData,
  ZoneTransitionData,
  NpcSpawnData,
  NpcScheduleEntryData,
  DialogueNodeData,
} from "./ZoneTypes";
export {
  DIRECTION_DELTA,
  MovementSystem,
  NpcScheduleSystem,
  parseScheduleTime,
} from "./systems";
export type { Direction, ScheduledNpcPosition } from "./systems";
export { TickCounter } from "./tick";
export {
  START_WORLD_TIME_MINUTES,
  WORLD_CALENDAR,
  WORLD_MONTH_NAMES,
  WORLD_TIME_ACTION_COST,
  createWorldTimeSnapshot,
  encodeWorldDateTime,
  formatWorldDateTime,
  getWorldMinuteOfDay,
} from "./time/WorldCalendar";
export type {
  WorldDateTime,
  WorldMonthName,
  WorldTimeSnapshot,
} from "./time/WorldCalendar";
export { getAllItemIds, getItemDef, hasItemDef } from "./items/itemRegistry";
export type { ItemDef, ItemDefMap } from "./items/ItemDef";
export { getItemMapPresentation } from "./items/itemMapPresentation";
export type { ItemMapPresentation } from "./items/itemMapPresentation";
export {
  getAllDialogueIds,
  getDialogue,
  hasDialogue,
} from "./dialogues/dialogueRegistry";
export type { DialogueDefMap, DialogueId } from "./dialogues/DialogueDef";
export {
  COMMON_NPC_GLYPH,
  getNpcMapPresentation,
} from "./npcs/npcMapPresentation";
export type { NpcMapPresentation } from "./npcs/npcMapPresentation";
export { getAllNpcDefs, getNpcDef, hasNpcDef } from "./npcs/npcRegistry";
export {
  getAllNpcPresenceDefs,
  getNpcPresenceDef,
  hasNpcPresenceDef,
} from "./npcs/npcPresenceRegistry";
export type {
  NpcDef,
  NpcDefMap,
  NpcImportance,
  NpcPresentationOverride,
  NpcRace,
} from "./npcs/NpcDef";
export type {
  NpcPresenceDef,
  NpcPresenceDefMap,
} from "./npcs/NpcPresenceDef";
export {
  cloneNpcState,
  cloneNpcStateMap,
  createInitialNpcState,
} from "./npcs/NpcState";
export type { NpcState, NpcStateMap } from "./npcs/NpcState";
export type { CombatActionCommand, GameCommand } from "./commands";
export { createNpcStats } from "./stats/npcStats";
export { GameplayEngine } from "./GameplayEngine";
export type {
  EngineNotice,
  EngineEffect,
  ExecuteResult,
  GameSnapshot,
  RenderEntity,
} from "./GameplayEngine";
export type { LogEntry } from "./LogEntry";
export type { GameSaveData } from "./GameSaveData";
export { SAVE_VERSION } from "./GameSaveData";
export {
  getQuestDef,
  getAllQuestDefs,
  hasQuestDef,
  validateQuestDef,
  validateQuestRegistry,
} from "./quests/questRegistry";
export type { QuestDef, QuestObjective, QuestRewards, QuestTriggers, QuestNpcOverride } from "./quests/QuestDef";
