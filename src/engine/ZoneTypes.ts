export type TileId = number;

export interface PlayerStart {
  x: number;
  y: number;
}

export type TileGrid = TileId[][];

export interface ZoneData {
  version: string;
  zoneId: string;
  name: string;
  width: number;
  height: number;
  playerStart: PlayerStart;
  tiles: TileGrid;
}
