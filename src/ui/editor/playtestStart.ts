import type { ContentCatalogSnapshot } from "../../engine";

export type EditorPlaytestStart = {
  zoneId: string;
  x: number;
  y: number;
};

export type EditorPlaytestStartInput = {
  snapshot: ContentCatalogSnapshot;
  selectedZoneId: string;
  pinnedInspectCell?: { x: number; y: number } | null;
};

export function resolveEditorPlaytestStart({
  snapshot,
  selectedZoneId,
  pinnedInspectCell,
}: EditorPlaytestStartInput): EditorPlaytestStart {
  const zone =
    snapshot.zones[selectedZoneId] ??
    snapshot.zones[snapshot.game.defaultZoneId];

  if (!zone) {
    throw new Error("Cannot resolve a zone for editor playtest.");
  }

  const startCell =
    zone.zoneId === selectedZoneId &&
    pinnedInspectCell &&
    isWalkableCell(
      snapshot,
      zone.zoneId,
      pinnedInspectCell.x,
      pinnedInspectCell.y,
    )
      ? pinnedInspectCell
      : zone.playerStart;

  return {
    zoneId: zone.zoneId,
    x: startCell.x,
    y: startCell.y,
  };
}

function isWalkableCell(
  snapshot: ContentCatalogSnapshot,
  zoneId: string,
  x: number,
  y: number,
): boolean {
  const zone = snapshot.zones[zoneId];
  if (!zone || y < 0 || y >= zone.height || x < 0 || x >= zone.width) {
    return false;
  }

  const tileId = zone.tiles[y]?.[x];
  return tileId !== undefined && snapshot.tiles.get(tileId)?.walkable === true;
}
