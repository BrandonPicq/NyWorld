import { GameMap } from "./GameMap";
import type { ZoneData } from "./ZoneTypes";

export class ZoneLoadError extends Error {
  constructor(message: string) {
    super(`Invalid zone data: ${message}`);
    this.name = "ZoneLoadError";
  }
}

export function loadZone(data: unknown): GameMap {
  if (!isRecord(data)) {
    throw new ZoneLoadError("expected an object");
  }

  if (typeof data.version !== "string") {
    throw new ZoneLoadError("missing or invalid version");
  }

  if (typeof data.zoneId !== "string") {
    throw new ZoneLoadError("missing or invalid zoneId");
  }

  if (typeof data.name !== "string") {
    throw new ZoneLoadError("missing or invalid name");
  }

  if (typeof data.width !== "number" || !Number.isInteger(data.width) || data.width < 1) {
    throw new ZoneLoadError("width must be a positive integer");
  }

  if (typeof data.height !== "number" || !Number.isInteger(data.height) || data.height < 1) {
    throw new ZoneLoadError("height must be a positive integer");
  }

  if (!isPlayerStart(data.playerStart)) {
    throw new ZoneLoadError("missing or invalid playerStart");
  }

  if (data.playerStart.x < 0 || data.playerStart.x >= data.width) {
    throw new ZoneLoadError("playerStart.x is out of bounds");
  }

  if (data.playerStart.y < 0 || data.playerStart.y >= data.height) {
    throw new ZoneLoadError("playerStart.y is out of bounds");
  }

  if (!Array.isArray(data.tiles) || data.tiles.length !== data.height) {
    throw new ZoneLoadError("tiles must be an array with height rows");
  }

  for (let y = 0; y < data.height; y++) {
    const row = data.tiles[y];

    if (!Array.isArray(row) || row.length !== data.width) {
      throw new ZoneLoadError(`tiles row ${y} must have width columns`);
    }

    for (let x = 0; x < data.width; x++) {
      if (typeof row[x] !== "number" || !Number.isInteger(row[x])) {
        throw new ZoneLoadError(`tile at (${x}, ${y}) must be an integer`);
      }
    }
  }

  return new GameMap(data as unknown as ZoneData);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isPlayerStart(value: unknown): value is { x: number; y: number } {
  return (
    isRecord(value) &&
    typeof value.x === "number" &&
    typeof value.y === "number"
  );
}
