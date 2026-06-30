import type { TileId } from "./ZoneTypes";

export interface TileDef {
  name: string;
  walkable: boolean;
  glyph: string;
  color: string;
}

const registry: Record<TileId, TileDef> = {
  0: { name: "floor", walkable: true,  glyph: ".", color: "#3a3a3a" },
  1: { name: "wall",  walkable: false, glyph: "#", color: "#666666" },
};

export function getTileDef(id: TileId): TileDef {
  return registry[id] ?? registry[0];
}
