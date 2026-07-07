import tilesData from "../content/tiles/tiles.json";
import type { ContentDiagnostic } from "./content/ContentDiagnostic";
import { formatContentDiagnostic } from "./content/ContentDiagnostic";
import { CONTENT_TYPES } from "./content/contentTypes";
import type { TileId } from "./ZoneTypes";

const TILE_CONTENT_TYPE = CONTENT_TYPES.tile;
const FALLBACK_TILE_ID = "0";

export interface TileDef {
  name: string;
  walkable: boolean;
  glyph: string;
  color: string;
  studySpot?: boolean;
}

let overlayRegistry: Record<TileId, TileDef> | null = null;

const registry = buildRegistry(tilesData);

/**
 * Validates a raw tile catalog without throwing.
 *
 * Tiles are a leaf content type: zone grids reference them by numeric id, so
 * the catalog only needs internally consistent definitions.
 */
export function validateTileCatalog(value: unknown): ContentDiagnostic[] {
  const diagnostics: ContentDiagnostic[] = [];

  if (!isRecord(value)) {
    addTileError(
      diagnostics,
      undefined,
      "$",
      "Tile catalog must be an object map of tile definitions.",
    );
    return diagnostics;
  }

  if (!Object.prototype.hasOwnProperty.call(value, FALLBACK_TILE_ID)) {
    addTileError(
      diagnostics,
      FALLBACK_TILE_ID,
      "$",
      'Tile catalog must include tile id "0" because unknown tile ids fall back to tile 0.',
    );
  }

  for (const [tileKey, def] of Object.entries(value)) {
    if (!/^(0|[1-9][0-9]*)$/.test(tileKey)) {
      addTileError(
        diagnostics,
        tileKey,
        "$",
        `Tile id "${tileKey}" must be a non-negative integer.`,
      );
      continue;
    }

    validateTileDef(tileKey, def, diagnostics);
  }

  return diagnostics;
}

function validateTileDef(
  tileKey: string,
  value: unknown,
  diagnostics: ContentDiagnostic[],
): void {
  if (!isRecord(value)) {
    addTileError(
      diagnostics,
      tileKey,
      "$",
      `Tile "${tileKey}" must be an object.`,
    );
    return;
  }

  if (typeof value.name !== "string" || !value.name.trim()) {
    addTileError(
      diagnostics,
      tileKey,
      "name",
      `Tile "${tileKey}" has invalid or missing name.`,
    );
  }

  if (typeof value.walkable !== "boolean") {
    addTileError(
      diagnostics,
      tileKey,
      "walkable",
      `Tile "${tileKey}" has invalid or missing walkable flag.`,
    );
  }

  if (typeof value.glyph !== "string" || value.glyph.length !== 1) {
    addTileError(
      diagnostics,
      tileKey,
      "glyph",
      `Tile "${tileKey}" glyph must be exactly one character.`,
    );
  }

  if (typeof value.color !== "string" || !value.color.trim()) {
    addTileError(
      diagnostics,
      tileKey,
      "color",
      `Tile "${tileKey}" has invalid or missing color.`,
    );
  }

  if (value.studySpot !== undefined && typeof value.studySpot !== "boolean") {
    addTileError(
      diagnostics,
      tileKey,
      "studySpot",
      `Tile "${tileKey}" studySpot must be a boolean.`,
    );
  }
}

function buildRegistry(value: unknown): Record<TileId, TileDef> {
  const diagnostics = validateTileCatalog(value);
  const firstError = diagnostics.find(
    (diagnostic) => diagnostic.severity === "error",
  );

  if (firstError) {
    throw new Error(formatContentDiagnostic(firstError));
  }

  const catalog = value as Record<string, TileDef>;
  return Object.fromEntries(
    Object.entries(catalog).map(([tileKey, def]) => [
      Number(tileKey),
      { ...def },
    ]),
  );
}

function addTileError(
  diagnostics: ContentDiagnostic[],
  tileId: string | undefined,
  path: string,
  message: string,
): void {
  diagnostics.push({
    severity: "error",
    contentType: TILE_CONTENT_TYPE,
    contentId: tileId,
    path,
    message,
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function hasTileDef(id: TileId): boolean {
  return Object.prototype.hasOwnProperty.call(getActiveRegistry(), id);
}

export function getTileDef(id: TileId): TileDef {
  const activeRegistry = getActiveRegistry();
  return activeRegistry[id] ?? activeRegistry[0];
}

/**
 * Returns every registered tile definition keyed by numeric tile id.
 *
 * Validation contexts use this map so zone checks can test tile existence and
 * walkability without reading the runtime registry directly.
 */
export function getAllTileDefs(): ReadonlyMap<TileId, TileDef> {
  return new Map(
    Object.entries(getActiveRegistry()).map(([tileKey, def]) => [
      Number(tileKey),
      { ...def },
    ]),
  );
}

export function installTileContentOverlay(
  tiles: ReadonlyMap<TileId, TileDef>,
): void {
  if (!import.meta.env.DEV) return;
  overlayRegistry = buildRegistry(Object.fromEntries(tiles.entries()));
}

export function clearTileContentOverlay(): void {
  overlayRegistry = null;
}

function getActiveRegistry(): Record<TileId, TileDef> {
  return overlayRegistry ?? registry;
}

if (import.meta.hot) {
  import.meta.hot.dispose(clearTileContentOverlay);
}
