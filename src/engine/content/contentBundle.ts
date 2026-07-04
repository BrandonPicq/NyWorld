import gameConfigData from "../../content/game.json";
import { GameMap } from "../GameMap";
import { getTileDef } from "../TileRegistry";
import type {
  DialogueNodeData,
  ItemSpawnData,
  NpcScheduleEntryData,
  NpcSpawnData,
  ZoneData,
  ZoneTransitionData,
} from "../ZoneTypes";
import { loadZone } from "../zoneLoader";

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
 * Global game content that should be authored as data instead of hardcoded in
 * UI or engine modules.
 */
export interface GameContentConfig {
  /** Zone used when starting a new game without save data. */
  defaultZoneId: string;
  /** Safe recovery point used by generic defeat/recovery flows. */
  safeRespawn: SafeRespawnPoint;
}

/**
 * Static content snapshot available to the runtime.
 *
 * The bundle keeps raw authoring data, not mutable gameplay state. Runtime
 * systems should resolve zones into fresh GameMap instances before using them.
 */
export interface ContentBundle {
  game: GameContentConfig;
  zones: Record<string, ZoneData>;
}

const zoneDataModules = getSortedContentModules(
  import.meta.glob<unknown>("../../content/zones/*.json", {
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
}): ContentBundle {
  const zones = buildZoneDataRegistry(input.zones);
  const game = parseGameContentConfig(input.gameConfig);

  if (!zones[game.defaultZoneId]) {
    throw new Error(
      `Game content references unknown defaultZoneId "${game.defaultZoneId}".`,
    );
  }

  assertSafeRespawn(zones, game.safeRespawn);

  return {
    game: cloneGameContentConfig(game),
    zones: cloneZoneRegistry(zones),
  };
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
 * Returns the configured safe respawn point as a detached value.
 */
export function getSafeRespawn(bundle: ContentBundle): SafeRespawnPoint {
  return { ...bundle.game.safeRespawn };
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
function buildZoneDataRegistry(defs: unknown[]): Record<string, ZoneData> {
  const zones: Record<string, ZoneData> = {};

  for (const def of defs) {
    const zone = loadZone(def);

    if (zones[zone.zoneId]) {
      throw new Error(`Duplicate zone definition "${zone.zoneId}".`);
    }

    zones[zone.zoneId] = cloneZoneData(def as ZoneData);
  }

  return zones;
}

/**
 * Parses the global game config before cross-reference validation can happen.
 */
function parseGameContentConfig(value: unknown): GameContentConfig {
  if (!isRecord(value)) {
    throw new Error("Game content config must be an object.");
  }

  if (typeof value.defaultZoneId !== "string" || !value.defaultZoneId.trim()) {
    throw new Error("Game content config has invalid defaultZoneId.");
  }

  if (!isRecord(value.safeRespawn)) {
    throw new Error("Game content config has invalid safeRespawn.");
  }

  const safeRespawn = value.safeRespawn;
  if (typeof safeRespawn.zoneId !== "string" || !safeRespawn.zoneId.trim()) {
    throw new Error("Game content config has invalid safeRespawn.zoneId.");
  }
  if (
    typeof safeRespawn.x !== "number" ||
    !Number.isInteger(safeRespawn.x)
  ) {
    throw new Error("Game content config has invalid safeRespawn.x.");
  }
  if (
    typeof safeRespawn.y !== "number" ||
    !Number.isInteger(safeRespawn.y)
  ) {
    throw new Error("Game content config has invalid safeRespawn.y.");
  }

  return {
    defaultZoneId: value.defaultZoneId,
    safeRespawn: {
      zoneId: safeRespawn.zoneId,
      x: safeRespawn.x,
      y: safeRespawn.y,
    },
  };
}

/**
 * Verifies that the authored safe respawn points at an existing walkable tile.
 */
function assertSafeRespawn(
  zones: Record<string, ZoneData>,
  safeRespawn: SafeRespawnPoint,
): void {
  const zoneData = zones[safeRespawn.zoneId];
  if (!zoneData) {
    throw new Error(
      `Game content safeRespawn references unknown zoneId "${safeRespawn.zoneId}".`,
    );
  }

  if (
    safeRespawn.x < 0 ||
    safeRespawn.x >= zoneData.width ||
    safeRespawn.y < 0 ||
    safeRespawn.y >= zoneData.height
  ) {
    throw new Error("Game content safeRespawn is out of bounds.");
  }

  const tileId = zoneData.tiles[safeRespawn.y][safeRespawn.x];
  if (!getTileDef(tileId).walkable) {
    throw new Error("Game content safeRespawn must be on a walkable tile.");
  }
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
