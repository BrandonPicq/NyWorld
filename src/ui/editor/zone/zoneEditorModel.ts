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
