import gameConfigData from "../../content/game.json";
import type { CharacterSkills, CoreAttributes } from "../components";
import type { ContentDiagnostic } from "./ContentDiagnostic";
import { formatContentDiagnostic } from "./ContentDiagnostic";
import { CONTENT_TYPES } from "./contentTypes";
import type { ContentValidationContext } from "./ContentValidationContext";
import { GameMap } from "../GameMap";
import { getAllItemIds } from "../items/itemRegistry";
import type {
  DialogueNodeData,
  ItemSpawnData,
  NpcScheduleEntryData,
  NpcSpawnData,
  ZoneData,
  ZoneTransitionData,
} from "../ZoneTypes";
import { loadZone } from "../zoneLoader";
import type { EventDef } from "../events/EventDef";

/**
 * Author-controlled recovery point used when gameplay needs to return the
 * player to a safe place, such as after combat defeat.
 */
export interface SafeRespawnPoint {
  zoneId: string;
  x: number;
  y: number;
}

/**
 * One authored starting inventory stack for a fresh playthrough.
 */
export interface NewGameStartingStack {
  itemId: string;
  quantity: number;
}

/**
 * Authored starting state for a new game.
 *
 * Saves store the full mutable player state, so this config only affects
 * fresh playthroughs.
 */
export interface NewGameConfig {
  startingCurrency: number;
  maxEnergy: number;
  startingInventory: NewGameStartingStack[];
  attributes: CoreAttributes;
  skills: CharacterSkills;
}

/**
 * Authored tuning for the out-of-combat player actions.
 *
 * Study reuses academicProgressGain for both academic progress and the
 * scholarship skill gain, matching the current gameplay behavior.
 */
export interface ActionTuningConfig {
  rest: {
    energyRestore: number;
    timeCostMinutes?: number;
    xp?: number;
  };
  study: {
    energyCost: number;
    academicProgressGain: number;
    intelligenceGain: number;
    timeCostMinutes?: number;
    xp?: number;
  };
}

/**
 * Global game content that should be authored as data instead of hardcoded in
 * UI or engine modules.
 */
export interface GameContentConfig {
  /** Zone used when starting a new game without save data. */
  defaultZoneId: string;
  /** Safe recovery point used by generic defeat/recovery flows. */
  safeRespawn: SafeRespawnPoint;
  /** Tuning values for rest and study actions. */
  actions: ActionTuningConfig;
  /** Starting inventory, currency, and stats for a fresh playthrough. */
  newGame: NewGameConfig;
}

/**
 * Catalog subset that game config validation checks references against.
 */
export type GameConfigValidationContext = Pick<
  ContentValidationContext,
  "itemIds" | "zones"
>;

const ATTRIBUTE_KEYS: readonly (keyof CoreAttributes)[] = [
  "strength",
  "vitality",
  "agility",
  "intelligence",
  "spirit",
  "willpower",
  "perception",
  "charisma",
];

const SKILL_KEYS: readonly (keyof CharacterSkills)[] = [
  "melee",
  "ranged",
  "guard",
  "evasion",
  "spellcasting",
  "focus",
  "athletics",
  "scholarship",
  "speech",
];

/**
 * Static content snapshot available to the runtime.
 *
 * The bundle keeps raw authoring data, not mutable gameplay state. Runtime
 * systems should resolve zones into fresh GameMap instances before using them.
 */
export interface ContentBundle {
  game: GameContentConfig;
  zones: Record<string, ZoneData>;
  events: EventDef[];
}

const zoneDataModules = getSortedContentModules(
  import.meta.glob<unknown>("../../content/zones/*.json", {
    eager: true,
    import: "default",
  }),
);

const eventDataModules = getSortedContentModules(
  import.meta.glob<unknown>("../../content/events/*.json", {
    eager: true,
    import: "default",
  }),
);

/**
 * Runtime bundle built from the source-controlled content shipped with the app.
 */
export const defaultContentBundle = createContentBundle({
  gameConfig: gameConfigData,
  zones: zoneDataModules,
  events: eventDataModules,
});

/**
 * Builds the immutable static content bundle used by the runtime.
 *
 * Editors can later build the same shape from in-memory drafts or mod folders
 * before asking the engine to resolve a zone.
 */
export function createContentBundle(input: {
  gameConfig: unknown;
  zones: unknown[];
  events?: unknown[];
}): ContentBundle {
  const { zones, zoneMaps } = buildZoneDataRegistry(input.zones);

  const diagnostics = validateGameConfig(input.gameConfig, {
    itemIds: new Set(getAllItemIds()),
    zones: zoneMaps,
  });
  const firstError = diagnostics.find(
    (diagnostic) => diagnostic.severity === "error",
  );
  if (firstError) {
    throw new Error(formatContentDiagnostic(firstError));
  }

  return {
    game: cloneGameContentConfig(input.gameConfig as GameContentConfig),
    zones: cloneZoneRegistry(zones),
    events: cloneEventRegistry((input.events ?? []) as EventDef[]),
  };
}

export function getEventDefs(bundle: ContentBundle): EventDef[] {
  return cloneEventRegistry(bundle.events);
}

/**
 * Returns authoring data for the configured new-game zone.
 *
 * Callers receive a detached copy so accidental mutations cannot affect the
 * shared bundle or imported JSON modules.
 */
export function getDefaultZoneData(bundle: ContentBundle): ZoneData {
  const zoneData = getZoneData(bundle, bundle.game.defaultZoneId);
  if (!zoneData) {
    throw new Error(
      `Content bundle default zone "${bundle.game.defaultZoneId}" is not available.`,
    );
  }
  return zoneData;
}

/**
 * Returns detached authoring data for a zone id, if that zone exists.
 */
export function getZoneData(
  bundle: ContentBundle,
  zoneId: string,
): ZoneData | undefined {
  const zoneData = bundle.zones[zoneId];
  return zoneData ? cloneZoneData(zoneData) : undefined;
}

/**
 * Returns the authored game config as a detached value.
 */
export function getGameConfig(bundle: ContentBundle): GameContentConfig {
  return cloneGameContentConfig(bundle.game);
}

/**
 * Returns the configured safe respawn point as a detached value.
 */
export function getSafeRespawn(bundle: ContentBundle): SafeRespawnPoint {
  return { ...bundle.game.safeRespawn };
}

/**
 * Returns the authored new-game starting state as a detached value.
 */
export function getNewGameConfig(bundle: ContentBundle): NewGameConfig {
  return cloneNewGameConfig(bundle.game.newGame);
}

/**
 * Returns the authored action tuning as a detached value.
 */
export function getActionTuning(bundle: ContentBundle): ActionTuningConfig {
  return cloneActionTuningConfig(bundle.game.actions);
}

/**
 * Converts a bundled zone into a fresh runtime GameMap.
 *
 * This is the bridge from editor/content data into simulation-ready data. It
 * intentionally creates a new map for every call so zone-local mutations stay
 * isolated to the active engine instance.
 */
export function resolveZoneFromBundle(
  bundle: ContentBundle,
  zoneId: string,
): GameMap | undefined {
  const zoneData = getZoneData(bundle, zoneId);
  return zoneData ? loadZone(zoneData) : undefined;
}

/**
 * Resolves every bundled zone into a fresh runtime GameMap keyed by zone id.
 *
 * Validation contexts use this map so reference checks can test zone existence
 * and tile walkability without reading registries directly.
 */
export function resolveAllZonesFromBundle(
  bundle: ContentBundle,
): ReadonlyMap<string, GameMap> {
  const zones = new Map<string, GameMap>();

  for (const zoneId of Object.keys(bundle.zones)) {
    const zone = resolveZoneFromBundle(bundle, zoneId);
    if (!zone) {
      throw new Error(`Zone definition "${zoneId}" is not available.`);
    }
    zones.set(zone.zoneId, zone);
  }

  return zones;
}

/**
 * Validates zone authoring data through loadZone, then stores detached raw data
 * by zone id for later runtime resolution.
 */
function buildZoneDataRegistry(defs: unknown[]): {
  zones: Record<string, ZoneData>;
  zoneMaps: ReadonlyMap<string, GameMap>;
} {
  const zones: Record<string, ZoneData> = {};
  const zoneMaps = new Map<string, GameMap>();

  for (const def of defs) {
    const zone = loadZone(def);

    if (zones[zone.zoneId]) {
      throw new Error(`Duplicate zone definition "${zone.zoneId}".`);
    }

    zones[zone.zoneId] = cloneZoneData(def as ZoneData);
    zoneMaps.set(zone.zoneId, zone);
  }

  return { zones, zoneMaps };
}

/**
 * Validates the global game config against an explicit content context.
 *
 * This is the editor-facing path: it accumulates every authoring problem so
 * tools can report entry-point, respawn, and new-game issues at once.
 */
export function validateGameConfig(
  value: unknown,
  context: GameConfigValidationContext,
): ContentDiagnostic[] {
  const diagnostics: ContentDiagnostic[] = [];

  if (!isRecord(value)) {
    addGameConfigError(diagnostics, "$", "Game content config must be an object.");
    return diagnostics;
  }

  if (typeof value.defaultZoneId !== "string" || !value.defaultZoneId.trim()) {
    addGameConfigError(
      diagnostics,
      "defaultZoneId",
      "Game content config has invalid defaultZoneId.",
    );
  } else if (!context.zones.has(value.defaultZoneId)) {
    addGameConfigError(
      diagnostics,
      "defaultZoneId",
      `Game content references unknown defaultZoneId "${value.defaultZoneId}".`,
    );
  }

  validateSafeRespawn(value.safeRespawn, context, diagnostics);
  validateActionTuning(value.actions, diagnostics);
  validateNewGameConfig(value.newGame, context, diagnostics);

  return diagnostics;
}

function validateActionTuning(
  value: unknown,
  diagnostics: ContentDiagnostic[],
): void {
  if (!isRecord(value)) {
    addGameConfigError(
      diagnostics,
      "actions",
      "Game content config has invalid or missing actions.",
    );
    return;
  }

  if (!isRecord(value.rest)) {
    addGameConfigError(
      diagnostics,
      "actions.rest",
      "Game content actions.rest must be an object.",
    );
  } else {
    validatePositiveInteger(
      value.rest.energyRestore,
      "actions.rest.energyRestore",
      diagnostics,
    );
    if (value.rest.timeCostMinutes !== undefined) {
      validatePositiveInteger(
        value.rest.timeCostMinutes,
        "actions.rest.timeCostMinutes",
        diagnostics,
      );
    }
    if (value.rest.xp !== undefined) {
      validatePositiveInteger(
        value.rest.xp,
        "actions.rest.xp",
        diagnostics,
      );
    }
  }

  if (!isRecord(value.study)) {
    addGameConfigError(
      diagnostics,
      "actions.study",
      "Game content actions.study must be an object.",
    );
  } else {
    validatePositiveInteger(
      value.study.energyCost,
      "actions.study.energyCost",
      diagnostics,
    );
    validatePositiveInteger(
      value.study.academicProgressGain,
      "actions.study.academicProgressGain",
      diagnostics,
    );
    validatePositiveInteger(
      value.study.intelligenceGain,
      "actions.study.intelligenceGain",
      diagnostics,
    );
    if (value.study.timeCostMinutes !== undefined) {
      validatePositiveInteger(
        value.study.timeCostMinutes,
        "actions.study.timeCostMinutes",
        diagnostics,
      );
    }
    if (value.study.xp !== undefined) {
      validatePositiveInteger(
        value.study.xp,
        "actions.study.xp",
        diagnostics,
      );
    }
  }
}

function validatePositiveInteger(
  value: unknown,
  path: string,
  diagnostics: ContentDiagnostic[],
): void {
  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) {
    addGameConfigError(
      diagnostics,
      path,
      `Game content ${path} must be a positive integer.`,
    );
  }
}

function validateSafeRespawn(
  value: unknown,
  context: GameConfigValidationContext,
  diagnostics: ContentDiagnostic[],
): void {
  if (!isRecord(value)) {
    addGameConfigError(
      diagnostics,
      "safeRespawn",
      "Game content config has invalid safeRespawn.",
    );
    return;
  }

  let structureValid = true;

  if (typeof value.zoneId !== "string" || !value.zoneId.trim()) {
    addGameConfigError(
      diagnostics,
      "safeRespawn.zoneId",
      "Game content config has invalid safeRespawn.zoneId.",
    );
    structureValid = false;
  }
  if (typeof value.x !== "number" || !Number.isInteger(value.x)) {
    addGameConfigError(
      diagnostics,
      "safeRespawn.x",
      "Game content config has invalid safeRespawn.x.",
    );
    structureValid = false;
  }
  if (typeof value.y !== "number" || !Number.isInteger(value.y)) {
    addGameConfigError(
      diagnostics,
      "safeRespawn.y",
      "Game content config has invalid safeRespawn.y.",
    );
    structureValid = false;
  }

  if (!structureValid) {
    return;
  }

  const zone = context.zones.get(value.zoneId as string);
  if (!zone) {
    addGameConfigError(
      diagnostics,
      "safeRespawn.zoneId",
      `Game content safeRespawn references unknown zoneId "${value.zoneId}".`,
    );
    return;
  }

  const x = value.x as number;
  const y = value.y as number;

  if (x < 0 || x >= zone.width || y < 0 || y >= zone.height) {
    addGameConfigError(
      diagnostics,
      "safeRespawn",
      "Game content safeRespawn is out of bounds.",
    );
    return;
  }

  if (!zone.isWalkable(x, y)) {
    addGameConfigError(
      diagnostics,
      "safeRespawn",
      "Game content safeRespawn must be on a walkable tile.",
    );
  }
}

function validateNewGameConfig(
  value: unknown,
  context: GameConfigValidationContext,
  diagnostics: ContentDiagnostic[],
): void {
  if (!isRecord(value)) {
    addGameConfigError(
      diagnostics,
      "newGame",
      "Game content config has invalid or missing newGame.",
    );
    return;
  }

  if (
    typeof value.startingCurrency !== "number" ||
    !Number.isInteger(value.startingCurrency) ||
    value.startingCurrency < 0
  ) {
    addGameConfigError(
      diagnostics,
      "newGame.startingCurrency",
      "Game content newGame.startingCurrency must be a non-negative integer.",
    );
  }

  if (
    typeof value.maxEnergy !== "number" ||
    !Number.isInteger(value.maxEnergy) ||
    value.maxEnergy <= 0
  ) {
    addGameConfigError(
      diagnostics,
      "newGame.maxEnergy",
      "Game content newGame.maxEnergy must be a positive integer.",
    );
  }

  if (!Array.isArray(value.startingInventory)) {
    addGameConfigError(
      diagnostics,
      "newGame.startingInventory",
      "Game content newGame.startingInventory must be an array.",
    );
  } else {
    for (let i = 0; i < value.startingInventory.length; i++) {
      const stack = value.startingInventory[i];
      const path = `newGame.startingInventory[${i}]`;

      if (!isRecord(stack)) {
        addGameConfigError(diagnostics, path, `Starting stack ${i} must be an object.`);
        continue;
      }

      if (
        typeof stack.itemId !== "string" ||
        !context.itemIds.has(stack.itemId)
      ) {
        addGameConfigError(
          diagnostics,
          `${path}.itemId`,
          `Starting stack ${i} references unknown itemId "${stack.itemId}".`,
        );
      }
      if (
        typeof stack.quantity !== "number" ||
        !Number.isInteger(stack.quantity) ||
        stack.quantity <= 0
      ) {
        addGameConfigError(
          diagnostics,
          `${path}.quantity`,
          `Starting stack ${i} has invalid quantity. Expected a positive integer.`,
        );
      }
    }
  }

  validateStatSection(value.attributes, "attributes", ATTRIBUTE_KEYS, diagnostics);
  validateStatSection(value.skills, "skills", SKILL_KEYS, diagnostics);
}

function validateStatSection(
  value: unknown,
  sectionName: string,
  requiredKeys: readonly string[],
  diagnostics: ContentDiagnostic[],
): void {
  if (!isRecord(value)) {
    addGameConfigError(
      diagnostics,
      `newGame.${sectionName}`,
      `Game content newGame.${sectionName} must be an object.`,
    );
    return;
  }

  for (const key of requiredKeys) {
    const statValue = value[key];
    if (
      typeof statValue !== "number" ||
      !Number.isInteger(statValue) ||
      statValue < 0
    ) {
      addGameConfigError(
        diagnostics,
        `newGame.${sectionName}.${key}`,
        `Game content newGame.${sectionName}.${key} must be a non-negative integer.`,
      );
    }
  }
}

function addGameConfigError(
  diagnostics: ContentDiagnostic[],
  path: string,
  message: string,
): void {
  diagnostics.push({
    severity: "error",
    contentType: CONTENT_TYPES.game,
    path,
    message,
  });
}

/**
 * Gives deterministic registry order regardless of filesystem glob ordering.
 */
function getSortedContentModules(modules: Record<string, unknown>): unknown[] {
  return Object.entries(modules)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, module]) => module);
}

/**
 * Clones global config so consumers cannot mutate the shared bundle.
 */
function cloneGameContentConfig(config: GameContentConfig): GameContentConfig {
  return {
    defaultZoneId: config.defaultZoneId,
    safeRespawn: { ...config.safeRespawn },
    actions: cloneActionTuningConfig(config.actions),
    newGame: cloneNewGameConfig(config.newGame),
  };
}

function cloneActionTuningConfig(config: ActionTuningConfig): ActionTuningConfig {
  return {
    rest: { ...config.rest },
    study: { ...config.study },
  };
}

function cloneNewGameConfig(config: NewGameConfig): NewGameConfig {
  return {
    startingCurrency: config.startingCurrency,
    maxEnergy: config.maxEnergy,
    startingInventory: config.startingInventory.map((stack) => ({ ...stack })),
    attributes: { ...config.attributes },
    skills: { ...config.skills },
  };
}

/**
 * Clones the zone registry shallowly by id and deeply enough for authored
 * nested arrays/objects that gameplay or editor previews may mutate.
 */
function cloneZoneRegistry(
  zones: Record<string, ZoneData>,
): Record<string, ZoneData> {
  return Object.fromEntries(
    Object.entries(zones).map(([zoneId, zoneData]) => [
      zoneId,
      cloneZoneData(zoneData),
    ]),
  );
}

function cloneEventRegistry(events: EventDef[]): EventDef[] {
  return events.map((event) => ({
    ...event,
    trigger:
      event.trigger.type === "step_on_area" ||
      event.trigger.type === "interact_on_area"
        ? { ...event.trigger, area: { ...event.trigger.area } }
        : { ...event.trigger },
    conditions: event.conditions.map((condition) => ({ ...condition })),
    actions: event.actions.map((action) => ({ ...action })),
    repeatPolicy:
      typeof event.repeatPolicy === "string"
        ? event.repeatPolicy
        : { ...event.repeatPolicy },
  }));
}

/**
 * Clones zone authoring data while preserving the JSON shape.
 */
function cloneZoneData(zoneData: ZoneData): ZoneData {
  return {
    ...zoneData,
    playerStart: { ...zoneData.playerStart },
    tiles: zoneData.tiles.map((row) => [...row]),
    transitions: zoneData.transitions?.map(cloneTransition),
    npcs: zoneData.npcs?.map(cloneNpcSpawn),
    items: zoneData.items?.map(cloneItemSpawn),
    entryDialogue: zoneData.entryDialogue?.map(cloneDialogueNode),
  };
}

function cloneTransition(
  transition: ZoneTransitionData,
): ZoneTransitionData {
  return { ...transition };
}

function cloneNpcSpawn(npc: NpcSpawnData): NpcSpawnData {
  return {
    ...npc,
    schedule: npc.schedule?.map(cloneNpcScheduleEntry),
  };
}

function cloneNpcScheduleEntry(
  entry: NpcScheduleEntryData,
): NpcScheduleEntryData {
  return { ...entry };
}

function cloneItemSpawn(item: ItemSpawnData): ItemSpawnData {
  return { ...item };
}

function cloneDialogueNode(node: DialogueNodeData): DialogueNodeData {
  return { ...node };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
