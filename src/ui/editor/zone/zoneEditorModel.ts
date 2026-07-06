import {
  createGameMapFromZoneData,
  getTileDef,
  type ContentCatalogSnapshot,
  type ContentValidationContext,
  type DialogueNodeData,
  type ItemSpawnData,
  type NpcScheduleEntryData,
  type NpcSpawnData,
  type ZoneData,
  type ZoneTransitionData,
} from "../../../engine";
import type { GridCell } from "../../../rendering/canvasCellMapping";


/**
 * Summary row for the editor zone list.
 *
 * Counts are derived from the authored zone data so the list can hint at a
 * zone's contents without opening it.
 */
export interface EditorZoneListEntry {
  zoneId: string;
  name: string;
  npcCount: number;
  itemCount: number;
  transitionCount: number;
}

/**
 * Lists the zones available in the editor, sorted by id for a stable order.
 */
export function listEditorZones(
  snapshot: ContentCatalogSnapshot,
): EditorZoneListEntry[] {
  return Object.values(snapshot.zones)
    .map(summarizeZone)
    .sort((a, b) => a.zoneId.localeCompare(b.zoneId));
}

function summarizeZone(zone: ZoneData): EditorZoneListEntry {
  return {
    zoneId: zone.zoneId,
    name: zone.name,
    npcCount: zone.npcs?.length ?? 0,
    itemCount: zone.items?.length ?? 0,
    transitionCount: zone.transitions?.length ?? 0,
  };
}

/** Content path a zone draft saves to; the file name is the stable zoneId. */
export function zoneContentPath(zoneId: string): string {
  return `src/content/zones/${zoneId}.json`;
}

export interface NewZoneInput {
  zoneId: string;
  name: string;
  width: number;
  height: number;
}

/**
 * Validates the fields of a new zone before it is created.
 *
 * Returns a message per problem (empty when the input is ready to create): the
 * id must be a fresh slug and the grid must be at least 3x3 so the wall border
 * leaves a walkable interior for the player start.
 */
export function validateNewZone(
  input: NewZoneInput,
  existingZoneIds: readonly string[],
): string[] {
  const errors: string[] = [];
  const zoneId = input.zoneId.trim();

  if (!zoneId) {
    errors.push("Zone id is required.");
  } else if (!/^[a-z0-9_]+$/.test(zoneId)) {
    errors.push("Zone id must be lowercase letters, digits, or underscores.");
  } else if (existingZoneIds.includes(zoneId)) {
    errors.push(`Zone "${zoneId}" already exists.`);
  }

  if (!input.name.trim()) {
    errors.push("Name is required.");
  }
  if (!Number.isInteger(input.width) || input.width < 3) {
    errors.push("Width must be an integer of at least 3.");
  }
  if (!Number.isInteger(input.height) || input.height < 3) {
    errors.push("Height must be an integer of at least 3.");
  }

  return errors;
}

/**
 * Builds a blank zone: a floor-filled grid with a wall border and the player
 * start on the first interior tile. Callers pass the floor/wall tile ids so the
 * fill stays content-driven rather than hardcoded.
 */
export function createBlankZone(
  input: NewZoneInput,
  floorTileId: number,
  wallTileId: number,
): ZoneData {
  const { width, height } = input;
  const tiles = Array.from({ length: height }, (_, y) =>
    Array.from({ length: width }, (_, x) =>
      x === 0 || y === 0 || x === width - 1 || y === height - 1
        ? wallTileId
        : floorTileId,
    ),
  );

  return {
    version: "0.1",
    zoneId: input.zoneId.trim(),
    name: input.name.trim(),
    width,
    height,
    playerStart: { x: 1, y: 1 },
    tiles,
  };
}

/** Deep copy so draft edits never mutate the shared catalog snapshot. */
export function cloneZoneData(zone: ZoneData): ZoneData {
  return structuredClone(zone);
}

/**
 * Swaps the draft zone into a catalog snapshot so a whole-bundle audit sees the
 * edit — the same injected-draft pattern the item editor uses.
 */
export function createZoneDraftSnapshot(
  snapshot: ContentCatalogSnapshot,
  draft: ZoneData,
): ContentCatalogSnapshot {
  return {
    ...snapshot,
    zones: { ...snapshot.zones, [draft.zoneId]: draft },
  };
}

/**
 * Builds a validation context whose zone map reflects the draft, so cross-zone
 * checks (e.g. a global NPC schedule walking into this zone) run against the
 * painted tiles rather than the shipped map.
 */
export function createZoneDraftValidationContext(
  context: ContentValidationContext,
  draft: ZoneData,
): ContentValidationContext {
  const zones = new Map(context.zones);
  try {
    zones.set(draft.zoneId, createGameMapFromZoneData(draft));
  } catch {
    // A structurally broken draft keeps the shipped map; validateAllContent
    // still surfaces the structural error through validateZoneData.
  }
  return { ...context, zones };
}

const TILES_PLACEHOLDER = "__NYWARUDO_TILES__";

/**
 * Serializes a zone as 2-space JSON, but keeps each `tiles` row on one line.
 *
 * Plain `JSON.stringify(zone, null, 2)` puts every tile number on its own line,
 * turning a grid into a hundred-line, undiffable block. Everything else stays
 * standard 2-space JSON so editor saves produce clean, reviewable diffs.
 */
export function serializeZoneData(zone: ZoneData): string {
  const withPlaceholder: Record<string, unknown> = {
    ...zone,
    tiles: TILES_PLACEHOLDER,
  };
  const json = JSON.stringify(withPlaceholder, null, 2);
  return json.replace(`"${TILES_PLACEHOLDER}"`, formatTilesBlock(zone.tiles));
}

function formatTilesBlock(tiles: ZoneData["tiles"]): string {
  if (tiles.length === 0) {
    return "[]";
  }
  const rows = tiles.map((row) => `    [${row.join(", ")}]`).join(",\n");
  return `[\n${rows}\n  ]`;
}

/**
 * Returns a zone with the tile at (x, y) set to tileId.
 *
 * Out-of-bounds coordinates and no-op paints return the same reference so a
 * drag that stays inside one cell does not churn React state.
 */
export function setTileAt(
  zone: ZoneData,
  x: number,
  y: number,
  tileId: number,
): ZoneData {
  const row = zone.tiles[y];
  if (y < 0 || y >= zone.tiles.length || x < 0 || !row || x >= row.length) {
    return zone;
  }
  if (row[x] === tileId) {
    return zone;
  }

  const tiles = zone.tiles.map((currentRow, rowIndex) =>
    rowIndex === y
      ? currentRow.map((tile, colIndex) => (colIndex === x ? tileId : tile))
      : currentRow,
  );
  return { ...zone, tiles };
}

/** Moves the player start; no-ops (same reference) when unchanged. */
export function setPlayerStart(zone: ZoneData, x: number, y: number): ZoneData {
  if (zone.playerStart.x === x && zone.playerStart.y === y) {
    return zone;
  }
  return { ...zone, playerStart: { x, y } };
}

/** Places an NPC spawn at (x, y), replacing any existing spawn on that cell. */
export function placeNpcAt(
  zone: ZoneData,
  x: number,
  y: number,
  npcId: string,
  dialogueId?: string,
): ZoneData {
  const spawn: NpcSpawnData = dialogueId
    ? { npcId, dialogueId, x, y }
    : { npcId, x, y };
  const others = (zone.npcs ?? []).filter((npc) => npc.x !== x || npc.y !== y);
  return { ...zone, npcs: [...others, spawn] };
}

/** Places an item stack at (x, y), replacing any existing stack on that cell. */
export function placeItemAt(
  zone: ZoneData,
  x: number,
  y: number,
  itemId: string,
  quantity: number,
): ZoneData {
  const stack: ItemSpawnData = { itemId, x, y, quantity };
  const others = (zone.items ?? []).filter(
    (item) => item.x !== x || item.y !== y,
  );
  return { ...zone, items: [...others, stack] };
}

/** Places a transition at (x, y), replacing any existing one on that cell. */
export function placeTransitionAt(
  zone: ZoneData,
  x: number,
  y: number,
  targetZoneId: string,
  targetX: number,
  targetY: number,
): ZoneData {
  const transition: ZoneTransitionData = {
    x,
    y,
    targetZoneId,
    targetX,
    targetY,
  };
  const others = (zone.transitions ?? []).filter(
    (existing) => existing.x !== x || existing.y !== y,
  );
  return { ...zone, transitions: [...others, transition] };
}

/**
 * Removes any NPC spawn, item stack, and transition on (x, y).
 *
 * Only the arrays that actually shrink are rebuilt, and undefined arrays stay
 * undefined, so an erase never introduces empty placement arrays. The player
 * start is never erased.
 */
export function erasePlacementsAt(
  zone: ZoneData,
  x: number,
  y: number,
): ZoneData {
  const result: ZoneData = { ...zone };
  let changed = false;

  if (zone.npcs) {
    const npcs = zone.npcs.filter((npc) => npc.x !== x || npc.y !== y);
    if (npcs.length !== zone.npcs.length) {
      result.npcs = npcs;
      changed = true;
    }
  }
  if (zone.items) {
    const items = zone.items.filter((item) => item.x !== x || item.y !== y);
    if (items.length !== zone.items.length) {
      result.items = items;
      changed = true;
    }
  }
  if (zone.transitions) {
    const transitions = zone.transitions.filter(
      (transition) => transition.x !== x || transition.y !== y,
    );
    if (transitions.length !== zone.transitions.length) {
      result.transitions = transitions;
      changed = true;
    }
  }

  return changed ? result : zone;
}

/**
 * True when `time` is a valid `HH:mm` 24-hour label.
 *
 * Mirrors the schedule system's `parseScheduleTime` contract so the editor can
 * flag a bad time inline without importing the engine system into the UI.
 */
export function isValidScheduleTime(time: string): boolean {
  const match = /^(\d{2}):(\d{2})$/.exec(time);
  if (!match) {
    return false;
  }
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  return hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59;
}

/**
 * Applies `transform` to the schedule of the NPC spawn at (spawnX, spawnY).
 *
 * Spawns are keyed by their cell like `placeNpcAt`, so at most one spawn matches.
 * A transform that returns the same array reference (a no-op edit) yields the
 * same zone reference; an empty result drops the `schedule` key entirely.
 */
function updateSpawnSchedule(
  zone: ZoneData,
  spawnX: number,
  spawnY: number,
  transform: (schedule: NpcScheduleEntryData[]) => NpcScheduleEntryData[],
): ZoneData {
  const npcs = zone.npcs;
  if (!npcs) {
    return zone;
  }
  const index = npcs.findIndex((npc) => npc.x === spawnX && npc.y === spawnY);
  if (index === -1) {
    return zone;
  }

  const spawn = npcs[index];
  const currentSchedule = spawn.schedule ?? [];
  const nextSchedule = transform(currentSchedule);
  if (nextSchedule === currentSchedule) {
    return zone;
  }

  const nextSpawn: NpcSpawnData = { ...spawn };
  if (nextSchedule.length > 0) {
    nextSpawn.schedule = nextSchedule;
  } else {
    delete nextSpawn.schedule;
  }
  const nextNpcs = npcs.map((npc, npcIndex) =>
    npcIndex === index ? nextSpawn : npc,
  );
  return { ...zone, npcs: nextNpcs };
}

/**
 * Appends a schedule entry to the spawn at (spawnX, spawnY), defaulting to the
 * spawn's own cell at 08:00 so the new entry starts valid and in-bounds.
 */
export function addNpcScheduleEntry(
  zone: ZoneData,
  spawnX: number,
  spawnY: number,
): ZoneData {
  return updateSpawnSchedule(zone, spawnX, spawnY, (schedule) => [
    ...schedule,
    { time: "08:00", x: spawnX, y: spawnY },
  ]);
}

/** Patches one field of schedule entry `index` on the spawn at (spawnX, spawnY). */
export function updateNpcScheduleEntry(
  zone: ZoneData,
  spawnX: number,
  spawnY: number,
  index: number,
  patch: Partial<NpcScheduleEntryData>,
): ZoneData {
  return updateSpawnSchedule(zone, spawnX, spawnY, (schedule) =>
    index < 0 || index >= schedule.length
      ? schedule
      : schedule.map((entry, entryIndex) =>
          entryIndex === index ? { ...entry, ...patch } : entry,
        ),
  );
}

/** Removes schedule entry `index` from the spawn at (spawnX, spawnY). */
export function removeNpcScheduleEntry(
  zone: ZoneData,
  spawnX: number,
  spawnY: number,
  index: number,
): ZoneData {
  return updateSpawnSchedule(zone, spawnX, spawnY, (schedule) =>
    index < 0 || index >= schedule.length
      ? schedule
      : schedule.filter((_, entryIndex) => entryIndex !== index),
  );
}

/** Appends a blank entry-dialogue line (neutral pitch) to the zone. */
export function addEntryDialogueNode(zone: ZoneData): ZoneData {
  const nodes = zone.entryDialogue ?? [];
  return {
    ...zone,
    entryDialogue: [...nodes, { speaker: "", text: "", pitch: 1 }],
  };
}

/** Patches one field of the entry-dialogue line at `index`. */
export function updateEntryDialogueNode(
  zone: ZoneData,
  index: number,
  patch: Partial<DialogueNodeData>,
): ZoneData {
  const nodes = zone.entryDialogue ?? [];
  if (index < 0 || index >= nodes.length) {
    return zone;
  }
  const entryDialogue = nodes.map((node, nodeIndex) =>
    nodeIndex === index ? { ...node, ...patch } : node,
  );
  return { ...zone, entryDialogue };
}

/** Removes the entry-dialogue line at `index`, dropping the key when empty. */
export function removeEntryDialogueNode(
  zone: ZoneData,
  index: number,
): ZoneData {
  const nodes = zone.entryDialogue ?? [];
  if (index < 0 || index >= nodes.length) {
    return zone;
  }
  const entryDialogue = nodes.filter((_, nodeIndex) => nodeIndex !== index);
  return {
    ...zone,
    entryDialogue: entryDialogue.length > 0 ? entryDialogue : undefined,
  };
}

export interface ZoneCellDescription {
  x: number;
  y: number;
  tileName: string;
  tileGlyph: string;
  walkable: boolean;
  whatSitsThere: string | null;
}

/**
 * Returns a description of what is located at (x, y) in the zone.
 * Includes the coordinates, tile name, glyph, walkable status, and any
 * entity (player start, NPC, item, or transition) sitting on the cell.
 */
export function describeZoneCell(
  zone: ZoneData,
  cell: GridCell,
): ZoneCellDescription | null {
  const { x, y } = cell;
  if (x < 0 || x >= zone.width || y < 0 || y >= zone.height) {
    return null;
  }
  const row = zone.tiles[y];
  if (!row) {
    return null;
  }
  const tileId = row[x];
  if (tileId === undefined) {
    return null;
  }
  const tileDef = getTileDef(tileId);

  let whatSitsThere: string | null = null;
  if (zone.playerStart.x === x && zone.playerStart.y === y) {
    whatSitsThere = "Player Start";
  } else {
    const npc = (zone.npcs ?? []).find((n) => n.x === x && n.y === y);
    if (npc) {
      whatSitsThere = `NPC: ${npc.npcId}`;
    } else {
      const item = (zone.items ?? []).find((i) => i.x === x && i.y === y);
      if (item) {
        whatSitsThere = `Item: ${item.itemId} (x${item.quantity})`;
      } else {
        const transition = (zone.transitions ?? []).find(
          (t) => t.x === x && t.y === y,
        );
        if (transition) {
          whatSitsThere = `Transition: ${transition.targetZoneId} (${transition.targetX}, ${transition.targetY})`;
        }
      }
    }
  }

  return {
    x,
    y,
    tileName: tileDef.name,
    tileGlyph: tileDef.glyph,
    walkable: tileDef.walkable,
    whatSitsThere,
  };
}

