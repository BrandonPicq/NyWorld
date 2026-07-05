import {
  createGameMapFromZoneData,
  type ContentCatalogSnapshot,
  type ContentValidationContext,
  type ItemSpawnData,
  type NpcSpawnData,
  type ZoneData,
  type ZoneTransitionData,
} from "../../../engine";

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
