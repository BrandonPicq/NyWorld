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
export type { StatPath } from "./stats/characterStats";
export {
  defaultContentBundle,
  createContentBundle,
  getActionTuning,
  getDefaultZoneData,
  getGameConfig,
  getNewGameConfig,
  getSafeRespawn,
  getZoneData,
  resolveAllZonesFromBundle,
  resolveZoneFromBundle,
  validateGameConfig,
} from "./content/contentBundle";
export type {
  ActionTuningConfig,
  ContentBundle,
  GameConfigValidationContext,
  GameContentConfig,
  NewGameConfig,
  NewGameStartingStack,
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
export { CONTENT_TYPES } from "./content/contentTypes";
export type { ContentTypeName } from "./content/contentTypes";
export {
  ITEM_CATEGORY_OPTIONS,
  NPC_IMPORTANCE_OPTIONS,
  NPC_RACE_OPTIONS,
} from "./content/editingMetadata";
export {
  createRuntimeContentValidationContext,
} from "./content/runtimeValidationContext";
export type {
  ContentValidationContext,
} from "./content/ContentValidationContext";
export { buildContentReferenceGraph } from "./content/ContentReferenceGraph";
export type {
  ContentCatalogSnapshot,
  ContentRef,
  ContentReference,
  ContentReferenceGraph,
  RenameImpact,
} from "./content/ContentReferenceGraph";
export {
  createRuntimeContentCatalogSnapshot,
} from "./content/runtimeContentCatalog";
export {
  getContentAuditErrors,
  validateAllContent,
} from "./content/contentAudit";
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
  deriveCombatActionEffects,
  getAllCombatActionDefs,
  getCombatActionDef,
  hasCombatActionDef,
  validateCombatActionDef,
  validateCombatActionRegistry,
} from "./combat/combatActionRegistry";
export type {
  CombatActionCategory,
  CombatActionDef,
  CombatActionDefMap,
  CombatActionId,
  CombatActionTuning,
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
  cloneEnemyStats,
  getAllEnemyDefs,
  getEnemyDef,
  hasEnemyDef,
  isCombatEnemy,
  validateEnemyDef,
  validateEnemyRegistry,
} from "./enemies/enemyRegistry";
export type { EnemyValidationContext } from "./enemies/enemyRegistry";
export type {
  EnemyDef,
  EnemyDefMap,
  EnemyLootEntry,
  EnemyStatsData,
} from "./enemies/EnemyDef";
export { World } from "./ecs";
export type { Component, EntityId } from "./ecs";
export { GameMap } from "./GameMap";
export {
  getAllTileDefs,
  getTileDef,
  hasTileDef,
  validateTileCatalog,
} from "./TileRegistry";
export type { TileDef } from "./TileRegistry";
export {
  ZoneLoadError,
  createGameMapFromZoneData,
  createRuntimeZoneValidationContext,
  loadZone,
  validateZoneData,
} from "./zoneLoader";
export type { ZoneValidationContext } from "./zoneLoader";
export type {
  PlayerStart,
  TileGrid,
  TileId,
  ZoneData,
  ZoneTransitionData,
  NpcSpawnData,
  NpcScheduleEntryData,
  ItemSpawnData,
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
export {
  getAllItemIds,
  getItemDef,
  hasItemDef,
  validateItemCatalog,
} from "./items/itemRegistry";
export type { ItemDef, ItemDefMap, ItemEffects } from "./items/ItemDef";
export { getItemMapPresentation } from "./items/itemMapPresentation";
export type { ItemMapPresentation } from "./items/itemMapPresentation";
export {
  getAllDialogueIds,
  getDialogue,
  getDialogueFiles,
  hasDialogue,
  validateDialogueFile,
  validateDialogueRegistry,
} from "./dialogues/dialogueRegistry";
export type { DialogueDefMap, DialogueId } from "./dialogues/DialogueDef";
export {
  COMMON_NPC_GLYPH,
  getNpcMapPresentation,
} from "./npcs/npcMapPresentation";
export type { NpcMapPresentation } from "./npcs/npcMapPresentation";
export {
  getAllNpcDefs,
  getNpcDef,
  hasNpcDef,
  validateNpcDef,
  validateNpcRegistry,
} from "./npcs/npcRegistry";
export type { NpcValidationContext } from "./npcs/npcRegistry";
export {
  getAllNpcPresenceDefs,
  getNpcPresenceDef,
  hasNpcPresenceDef,
  validateNpcPresenceDef,
  validateNpcPresenceRegistry,
} from "./npcs/npcPresenceRegistry";
export type { NpcPresenceValidationContext } from "./npcs/npcPresenceRegistry";
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
export type { QuestValidationContext } from "./quests/questRegistry";
export type { QuestDef, QuestObjective, QuestRewards, QuestTriggers, QuestNpcOverride } from "./quests/QuestDef";
