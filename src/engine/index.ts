export type {
  DialogueNode,
  EquippedItems,
  EquippedSlot,
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
export { EQUIPPED_SLOT_IDS } from "./components";
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
  DEFAULT_PLAYER_CLASS_ID,
  DEFAULT_PLAYER_RACE_ID,
  ATTRIBUTE_CHOICE_AMOUNT,
  ATTRIBUTE_CHOICE_INTERVAL,
  applyLayeredStats,
  applyXpAwardToProgression,
  cloneLayeredStatBreakdown,
  clonePlayerProgressionState,
  createInitialPlayerProgression,
  createStatsWithLayeredAttributes,
  deriveLayeredStats,
  getClassXpToNext,
  getGlobalXpToNext,
  normalizeProgressionBuffers,
  subtractAttributeValues,
} from "./stats/layeredStats";
export type {
  AttributeValues,
  CoreAttributeKey,
  LayeredStatBreakdown,
  PlayerClassProgression,
  PlayerProgressionState,
  ProgressionFractionalBuffers,
  XpAwardResult,
} from "./stats/layeredStats";
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
  getEventDefs,
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
  COMBAT_ACTION_CATEGORY_OPTIONS,
  CORE_ATTRIBUTE_OPTIONS,
  EQUIPMENT_ARMOR_SLOT_OPTIONS,
  EQUIPMENT_BONUS_OPTIONS,
  EQUIPMENT_MINIGAME_OPTIONS,
  EQUIPMENT_SLOT_OPTIONS,
  EQUIPMENT_WEAPON_TYPE_OPTIONS,
  ITEM_CATEGORY_OPTIONS,
  NPC_IMPORTANCE_OPTIONS,
  NPC_RACE_OPTIONS,
  QUEST_STAT_NAME_OPTIONS,
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
export type {
  EventAction,
  EventArea,
  EventCondition,
  EventDef,
  EventDefMap,
  EventQuestState,
  EventRepeatPolicy,
  EventTrigger,
} from "./events/EventDef";
export {
  getAllEventDefs,
  getEventDef,
  hasEventDef,
  validateEventDefForContext,
  validateEventDef,
  validateEventRegistry,
} from "./events/eventRegistry";
export type { EventValidationContext } from "./events/eventValidation";
export {
  getContentAuditErrors,
  validateAllContent,
} from "./content/contentAudit";
export {
  clearContentOverlay,
  installContentOverlay,
} from "./content/contentOverlay";
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
  computeDamageVarianceRange,
  estimateCombatDamageBand,
  HIDDEN_PATTERN_BALANCE_PROFILES,
  MASH_BALANCE_PROFILES,
  SEQUENCE_BALANCE_PROFILES,
  TIMING_BALANCE_PROFILES,
} from "./combat/combatBalanceModel";
export type {
  CombatDamageBand,
  CombatDamageBandInput,
  CombatPerformanceProfile,
  CombatPerformanceProfileId,
} from "./combat/combatBalanceModel";
export {
  summarizeCombatActionForTooltip,
} from "./combat/combatActionSummary";
export type {
  CombatActionTooltipSummary,
  CombatActionTooltipSummaryInput,
} from "./combat/combatActionSummary";
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
export {
  cloneQtePatternDef,
  getAllQtePatternDefs,
  getAllQtePatternIds,
  getQtePatternDef,
  hasQtePatternDef,
  validateQtePatternDef,
  validateQtePatternRegistry,
} from "./combat/qtePatternRegistry";
export type { QtePatternValidationContext } from "./combat/qtePatternRegistry";
export {
  canUseCombatPattern,
  getCombatPatternOptions,
} from "./combat/qtePatternCombat";
export type { CombatPatternOption } from "./combat/qtePatternCombat";
export type {
  KnownPatternMap,
  KnownPatternState,
  PatternDef,
  PatternDefMap,
  PatternEvolution,
  PatternKind,
} from "./combat/PatternDef";
export { cloneKnownPatterns } from "./combat/QtePatternLearningSystem";
export {
  cloneClassDef,
  getAllClassDefs,
  getAllClassIds,
  getClassDef,
  hasClassDef,
  validateClassDef,
  validateClassRegistry,
} from "./classes/classRegistry";
export type {
  AttributeGrowth,
  ClassDef,
  ClassDefMap,
  ClassEquipmentPermissions,
  ClassGrowthEntry,
  EquipmentArmorSlot,
  EquipmentWeaponType,
} from "./classes/ClassDef";
export { CombatSystem, isCombatNpc } from "./combat/CombatSystem";
export type {
  CombatEffect,
  CombatExecuteResult,
  CombatPhase,
  CombatState,
  CombatSystemContext,
} from "./combat/CombatSystem";
export {
  classifyTimingPress,
  computeMashTargetPresses,
  computeMasteryDelta,
  computeTimingWindowTravelSpeed,
  computeTimingWindows,
  createTimingWindowMotion,
  mapTimingVolley,
  modulateMashTarget,
  modulateSequenceLength,
  modulateSequenceTimeLimit,
  modulateTimingSweep,
  resolveWeaponMinigameType,
  stepTimingWindowMotion,
  DEFAULT_VOLLEY_SIZE,
  TIMING_BASE_SWEEP_MS,
  TIMING_WINDOW_DIRECTION_EXTRA_HOLD_MS,
  TIMING_WINDOW_DIRECTION_MIN_HOLD_MS,
  TIMING_WINDOW_TRAVEL_BASE_SPEED,
  TIMING_WINDOW_TRAVEL_MAX_SPEED,
  TIMING_WINDOW_TRAVEL_SPEED_PER_GAP,
  WEAPON_ARCHETYPE_MINIGAME,
} from "./combat/combatMinigame";
export type { TimingWindowMotion } from "./combat/combatMinigame";
export type {
  CombatMinigameSpec,
  MashMinigameSpec,
  SequenceMinigameSpec,
  TimingMinigameSpec,
  TimingShotOutcome,
} from "./combat/combatMinigame";
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
  getScheduledNpcPositionAt,
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
export type {
  EquipmentBonusKey,
  EquipmentBonusMap,
  EquipmentDef,
  EquipmentMinigameType,
  EquipmentSlot,
  ItemDef,
  ItemDefMap,
  ItemEffects,
} from "./items/ItemDef";
export { getItemMapPresentation } from "./items/itemMapPresentation";
export { canEquipInSlot } from "./items/equipmentRules";
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
export {
  cloneRaceDef,
  getAllRaceDefs,
  getAllRaceIds,
  getRaceDef,
  hasRaceDef,
  validateRaceDef,
  validateRaceRegistry,
} from "./races/raceRegistry";
export type {
  RaceDef,
  RaceDefMap,
  RaceGrowthMultipliers,
} from "./races/RaceDef";
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
export {
  cloneCommandMasteryDef,
  getAllCommandMasteryDefs,
  getCommandMasteryDef,
  hasCommandMasteryDef,
  validateCommandMasteryDef,
  validateCommandMasteryRegistry,
} from "./mastery/commandMasteryRegistry";
export type {
  CommandMasteryDef,
  CommandMasteryDefMap,
  CommandMasteryEffects,
} from "./mastery/CommandMasteryDef";
