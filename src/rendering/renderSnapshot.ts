import type { GameSnapshot } from "../engine/GameplayEngine";
import { getTileDef } from "../engine/TileRegistry";

export type GridTileRenderRole = "blocked" | "open";

export type GridRenderTile = {
  glyph: string;
  role: GridTileRenderRole;
};

export type GridRenderSnapshot = {
  width: number;
  height: number;
  player: {
    x: number;
    y: number;
  };
  tiles: GridRenderTile[][];
};

export function createGridRenderSnapshot(
  snapshot: GameSnapshot,
): GridRenderSnapshot {
  return {
    height: snapshot.mapHeight,
    player: {
      x: snapshot.playerX,
      y: snapshot.playerY,
    },
    tiles: snapshot.tiles.map((row) =>
      row.map((tileId) => {
        const tileDef = getTileDef(tileId);

        return {
          glyph: tileDef.glyph,
          role: tileDef.walkable ? "open" : "blocked",
        };
      }),
    ),
    width: snapshot.mapWidth,
  };
}
