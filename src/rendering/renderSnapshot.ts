import type { GameSnapshot, RenderEntity } from "../engine/GameplayEngine";
import { getTileDef } from "../engine/TileRegistry";

export type GridTileRenderRole = "blocked" | "open";

export type GridRenderTile = {
  glyph: string;
  role: GridTileRenderRole;
  visibility?: "hidden" | "explored" | "visible";
};

export type GridRenderSnapshot = {
  width: number;
  height: number;
  player: {
    x: number;
    y: number;
  };
  tiles: GridRenderTile[][];
  entities: RenderEntity[];
};

/**
 * Converts gameplay snapshots into the smaller render contract consumed by Canvas.
 *
 * Tile ids are resolved here so the renderer only receives display roles and
 * glyphs, never gameplay tile definitions.
 */
export function createGridRenderSnapshot(
  snapshot: GameSnapshot,
): GridRenderSnapshot {
  return {
    height: snapshot.mapHeight,
    player: {
      x: snapshot.playerX,
      y: snapshot.playerY,
    },
    tiles: snapshot.tiles.map((row, y) =>
      row.map((tileId, x) => {
        const tileDef = getTileDef(tileId);

        return {
          glyph: tileDef.glyph,
          role: tileDef.walkable ? "open" : "blocked",
          ...(snapshot.mapVisibility?.[y]?.[x]
            ? { visibility: snapshot.mapVisibility[y][x] }
            : {}),
        };
      }),
    ),
    width: snapshot.mapWidth,
    entities: snapshot.entities
      .filter((entity) => {
        const visibility = snapshot.mapVisibility?.[entity.y]?.[entity.x];
        return visibility !== "hidden" && visibility !== "explored";
      })
      .map((entity) => ({ ...entity })),
  };
}
