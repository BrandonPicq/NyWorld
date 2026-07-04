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

export interface SafeRespawnPoint {
  zoneId: string;
  x: number;
  y: number;
}

export interface GameContentConfig {
  defaultZoneId: string;
  safeRespawn: SafeRespawnPoint;
}

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

export function getDefaultZoneData(bundle: ContentBundle): ZoneData {
  const zoneData = getZoneData(bundle, bundle.game.defaultZoneId);
  if (!zoneData) {
    throw new Error(
      `Content bundle default zone "${bundle.game.defaultZoneId}" is not available.`,
    );
  }
  return zoneData;
}

export function getZoneData(
  bundle: ContentBundle,
  zoneId: string,
): ZoneData | undefined {
  const zoneData = bundle.zones[zoneId];
  return zoneData ? cloneZoneData(zoneData) : undefined;
}

export function getSafeRespawn(bundle: ContentBundle): SafeRespawnPoint {
  return { ...bundle.game.safeRespawn };
}

export function resolveZoneFromBundle(
  bundle: ContentBundle,
  zoneId: string,
): GameMap | undefined {
  const zoneData = getZoneData(bundle, zoneId);
  return zoneData ? loadZone(zoneData) : undefined;
}

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

function getSortedContentModules(modules: Record<string, unknown>): unknown[] {
  return Object.entries(modules)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, module]) => module);
}

function cloneGameContentConfig(config: GameContentConfig): GameContentConfig {
  return {
    defaultZoneId: config.defaultZoneId,
    safeRespawn: { ...config.safeRespawn },
  };
}

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
