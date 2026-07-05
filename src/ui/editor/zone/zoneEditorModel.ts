import type { ContentCatalogSnapshot, ZoneData } from "../../../engine";

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

/** Deep copy so draft edits never mutate the shared catalog snapshot. */
export function cloneZoneData(zone: ZoneData): ZoneData {
  return structuredClone(zone);
}

/** Serialization convention shared with the item catalog: 2-space JSON. */
export function serializeZoneData(zone: ZoneData): string {
  return JSON.stringify(zone, null, 2);
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
