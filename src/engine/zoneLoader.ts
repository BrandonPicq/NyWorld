import { GameMap } from "./GameMap";
import type { ContentDiagnostic } from "./content/ContentDiagnostic";
import type { ContentValidationContext } from "./content/ContentValidationContext";
import { CONTENT_TYPES } from "./content/contentTypes";
import { getAllDialogueIds } from "./dialogues/dialogueRegistry";
import { getAllItemIds } from "./items/itemRegistry";
import { getAllNpcDefs } from "./npcs/npcRegistry";
import { parseScheduleTime } from "./systems/NpcScheduleSystem";
import { getAllTileDefs } from "./TileRegistry";
import type { ZoneData } from "./ZoneTypes";

const ZONE_CONTENT_TYPE = CONTENT_TYPES.zone;

/**
 * Catalog subset that zone validation checks references against.
 *
 * Tiles are provided as full definitions because spawn checks need
 * walkability, not just tile existence.
 */
export type ZoneValidationContext = Pick<
  ContentValidationContext,
  "npcIds" | "dialogueIds" | "itemIds" | "tileDefs"
>;

/**
 * Builds the zone validation subset from the shipped runtime registries.
 *
 * Editor drafts should build their own ZoneValidationContext instead so zone
 * checks run against draft catalogs rather than the active content.
 */
export function createRuntimeZoneValidationContext(): ZoneValidationContext {
  return {
    npcIds: new Set(getAllNpcDefs().map((npc) => npc.npcId)),
    dialogueIds: new Set(getAllDialogueIds()),
    itemIds: new Set(getAllItemIds()),
    tileDefs: getAllTileDefs(),
  };
}

export class ZoneLoadError extends Error {
  constructor(message: string) {
    super(`Invalid zone data: ${message}`);
    this.name = "ZoneLoadError";
  }
}

/**
 * Validates raw zone content and converts it into a runtime GameMap.
 *
 * Runtime callers should keep using this strict API: the first blocking content
 * error aborts map creation before invalid JSON can reach gameplay systems.
 * Editor-facing tools should call validateZoneData instead so they can show all
 * detected issues to the author in one pass.
 */
export function loadZone(data: unknown): GameMap {
  const diagnostics = validateZoneData(data);
  const firstError = diagnostics.find(
    (diagnostic) => diagnostic.severity === "error",
  );

  if (firstError) {
    throw new ZoneLoadError(firstError.message);
  }

  return createGameMapFromZoneData(data as ZoneData);
}

/**
 * Converts already validated zone data into the runtime map object.
 *
 * This deliberately does no structural checking: callers that accept unknown
 * JSON should validate first, while tests and registries can use this helper to
 * make the validation/conversion boundary explicit.
 */
export function createGameMapFromZoneData(zoneData: ZoneData): GameMap {
  return new GameMap(zoneData);
}

/**
 * Returns every zone validation issue that can be detected without mutating
 * content or constructing runtime entities.
 *
 * The diagnostic list is meant for future editor workflows where authors need
 * actionable paths and multiple errors at once instead of a single thrown
 * exception.
 */
export function validateZoneData(
  data: unknown,
  context: ZoneValidationContext = createRuntimeZoneValidationContext(),
): ContentDiagnostic[] {
  const diagnostics: ContentDiagnostic[] = [];

  if (!isRecord(data)) {
    addZoneError(diagnostics, undefined, "$", "expected an object");
    return diagnostics;
  }

  if (typeof data.version !== "string") {
    addZoneError(diagnostics, data, "version", "missing or invalid version");
  }

  if (typeof data.zoneId !== "string") {
    addZoneError(diagnostics, data, "zoneId", "missing or invalid zoneId");
  }

  if (typeof data.name !== "string") {
    addZoneError(diagnostics, data, "name", "missing or invalid name");
  }

  const width = readPositiveInteger(
    data.width,
    diagnostics,
    data,
    "width",
    "width must be a positive integer",
  );
  const height = readPositiveInteger(
    data.height,
    diagnostics,
    data,
    "height",
    "height must be a positive integer",
  );

  const playerStart = validatePlayerStart(data, diagnostics);
  const tiles = validateTileGrid(data, width, height, diagnostics, context);

  if (data.fogOfWar !== undefined && typeof data.fogOfWar !== "boolean") {
    addZoneError(diagnostics, data, "fogOfWar", "fogOfWar must be a boolean");
  }

  validatePlayerStartBounds(data, playerStart, width, height, diagnostics);
  validatePlayerStartWalkability(
    data,
    playerStart,
    width,
    height,
    tiles,
    diagnostics,
    context,
  );
  validateTransitions(data, width, height, tiles, diagnostics, context);
  validateEntryDialogue(data, diagnostics);
  validateNpcs(data, width, height, tiles, diagnostics, context);
  validateItems(data, playerStart, width, height, tiles, diagnostics, context);

  return diagnostics;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function addZoneError(
  diagnostics: ContentDiagnostic[],
  data: Record<string, unknown> | undefined,
  path: string,
  message: string,
): void {
  diagnostics.push({
    severity: "error",
    contentType: ZONE_CONTENT_TYPE,
    contentId: getZoneContentId(data),
    path,
    message,
  });
}

function getZoneContentId(
  data: Record<string, unknown> | undefined,
): string | undefined {
  return typeof data?.zoneId === "string" ? data.zoneId : undefined;
}

function readPositiveInteger(
  value: unknown,
  diagnostics: ContentDiagnostic[],
  data: Record<string, unknown>,
  path: string,
  message: string,
): number | undefined {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1) {
    addZoneError(diagnostics, data, path, message);
    return undefined;
  }

  return value;
}

function isPlayerStart(value: unknown): value is { x: number; y: number } {
  return (
    isRecord(value) &&
    typeof value.x === "number" &&
    Number.isInteger(value.x) &&
    typeof value.y === "number" &&
    Number.isInteger(value.y)
  );
}

function validatePlayerStart(
  data: Record<string, unknown>,
  diagnostics: ContentDiagnostic[],
): { x: number; y: number } | undefined {
  if (!isPlayerStart(data.playerStart)) {
    addZoneError(
      diagnostics,
      data,
      "playerStart",
      "missing or invalid playerStart",
    );
    return undefined;
  }

  return data.playerStart;
}

function validatePlayerStartBounds(
  data: Record<string, unknown>,
  playerStart: { x: number; y: number } | undefined,
  width: number | undefined,
  height: number | undefined,
  diagnostics: ContentDiagnostic[],
): void {
  if (!playerStart) {
    return;
  }

  if (width !== undefined && (playerStart.x < 0 || playerStart.x >= width)) {
    addZoneError(
      diagnostics,
      data,
      "playerStart.x",
      "playerStart.x is out of bounds",
    );
  }

  if (height !== undefined && (playerStart.y < 0 || playerStart.y >= height)) {
    addZoneError(
      diagnostics,
      data,
      "playerStart.y",
      "playerStart.y is out of bounds",
    );
  }
}

function validatePlayerStartWalkability(
  data: Record<string, unknown>,
  playerStart: { x: number; y: number } | undefined,
  width: number | undefined,
  height: number | undefined,
  tiles: unknown[][] | undefined,
  diagnostics: ContentDiagnostic[],
  context: ZoneValidationContext,
): void {
  if (
    !playerStart ||
    !tiles ||
    !isCoordinateInBounds(playerStart.x, playerStart.y, width, height)
  ) {
    return;
  }

  if (
    isKnownTileWalkable(tiles, playerStart.x, playerStart.y, context) === false
  ) {
    addZoneError(
      diagnostics,
      data,
      "playerStart",
      "playerStart must be on a walkable tile",
    );
  }
}

function validateTileGrid(
  data: Record<string, unknown>,
  width: number | undefined,
  height: number | undefined,
  diagnostics: ContentDiagnostic[],
  context: ZoneValidationContext,
): unknown[][] | undefined {
  if (!Array.isArray(data.tiles)) {
    addZoneError(
      diagnostics,
      data,
      "tiles",
      "tiles must be an array with height rows",
    );
    return undefined;
  }

  if (height !== undefined && data.tiles.length !== height) {
    addZoneError(
      diagnostics,
      data,
      "tiles",
      "tiles must be an array with height rows",
    );
  }

  for (let y = 0; y < data.tiles.length; y++) {
    const row = data.tiles[y];

    if (!Array.isArray(row)) {
      addZoneError(
        diagnostics,
        data,
        `tiles[${y}]`,
        `tiles row ${y} must have width columns`,
      );
      continue;
    }

    if (width !== undefined && row.length !== width) {
      addZoneError(
        diagnostics,
        data,
        `tiles[${y}]`,
        `tiles row ${y} must have width columns`,
      );
    }

    for (let x = 0; x < row.length; x++) {
      const tileId = row[x];

      if (typeof tileId !== "number" || !Number.isInteger(tileId)) {
        addZoneError(
          diagnostics,
          data,
          `tiles[${y}][${x}]`,
          `tile at (${x}, ${y}) must be an integer`,
        );
        continue;
      }

      if (!context.tileDefs.has(tileId)) {
        addZoneError(
          diagnostics,
          data,
          `tiles[${y}][${x}]`,
          `unknown tile id ${tileId} at (${x}, ${y})`,
        );
      }
    }
  }

  return data.tiles;
}

function validateTransitions(
  data: Record<string, unknown>,
  width: number | undefined,
  height: number | undefined,
  tiles: unknown[][] | undefined,
  diagnostics: ContentDiagnostic[],
  context: ZoneValidationContext,
): void {
  if (data.transitions === undefined) {
    return;
  }

  if (!Array.isArray(data.transitions)) {
    addZoneError(diagnostics, data, "transitions", "transitions must be an array");
    return;
  }

  for (let i = 0; i < data.transitions.length; i++) {
    const transition = data.transitions[i];
    const path = `transitions[${i}]`;

    if (!isRecord(transition)) {
      addZoneError(
        diagnostics,
        data,
        path,
        `transition at index ${i} must be an object`,
      );
      continue;
    }

    const hasValidX = validateGridCoordinate(
      transition.x,
      width,
      diagnostics,
      data,
      `${path}.x`,
      `transition at index ${i} has an invalid x`,
    );
    const hasValidY = validateGridCoordinate(
      transition.y,
      height,
      diagnostics,
      data,
      `${path}.y`,
      `transition at index ${i} has an invalid y`,
    );

    if (typeof transition.targetZoneId !== "string") {
      addZoneError(
        diagnostics,
        data,
        `${path}.targetZoneId`,
        `transition at index ${i} is missing a valid targetZoneId`,
      );
    }

    if (
      typeof transition.targetX !== "number" ||
      !Number.isInteger(transition.targetX)
    ) {
      addZoneError(
        diagnostics,
        data,
        `${path}.targetX`,
        `transition at index ${i} has an invalid targetX`,
      );
    }

    if (
      typeof transition.targetY !== "number" ||
      !Number.isInteger(transition.targetY)
    ) {
      addZoneError(
        diagnostics,
        data,
        `${path}.targetY`,
        `transition at index ${i} has an invalid targetY`,
      );
    }

    if (hasValidX && hasValidY && tiles) {
      const transitionX = transition.x as number;
      const transitionY = transition.y as number;

      if (isKnownTileWalkable(tiles, transitionX, transitionY, context) === false) {
        addZoneError(
          diagnostics,
          data,
          path,
          `transition at index ${i} must be on a walkable tile`,
        );
      }
    }
  }
}

function validateEntryDialogue(
  data: Record<string, unknown>,
  diagnostics: ContentDiagnostic[],
): void {
  if (data.entryDialogue !== undefined) {
    validateDialogueNodes(
      data.entryDialogue,
      "entryDialogue",
      "entryDialogue",
      data,
      diagnostics,
    );
  }
}

function validateNpcs(
  data: Record<string, unknown>,
  width: number | undefined,
  height: number | undefined,
  tiles: unknown[][] | undefined,
  diagnostics: ContentDiagnostic[],
  context: ZoneValidationContext,
): void {
  if (data.npcs === undefined) {
    return;
  }

  if (!Array.isArray(data.npcs)) {
    addZoneError(diagnostics, data, "npcs", "npcs must be an array");
    return;
  }

  for (let i = 0; i < data.npcs.length; i++) {
    const npc = data.npcs[i];
    const path = `npcs[${i}]`;

    if (!isRecord(npc)) {
      addZoneError(diagnostics, data, path, `npc at index ${i} must be an object`);
      continue;
    }

    if (typeof npc.npcId !== "string" || !npc.npcId.trim()) {
      addZoneError(
        diagnostics,
        data,
        `${path}.npcId`,
        `npc at index ${i} has invalid or missing npcId`,
      );
    } else if (!context.npcIds.has(npc.npcId)) {
      addZoneError(
        diagnostics,
        data,
        `${path}.npcId`,
        `npc at index ${i} references unknown npcId "${npc.npcId}"`,
      );
    }

    if (npc.dialogueId !== undefined) {
      if (typeof npc.dialogueId !== "string" || !npc.dialogueId.trim()) {
        addZoneError(
          diagnostics,
          data,
          `${path}.dialogueId`,
          `npc at index ${i} has invalid dialogueId`,
        );
      } else if (!context.dialogueIds.has(npc.dialogueId)) {
        addZoneError(
          diagnostics,
          data,
          `${path}.dialogueId`,
          `npc at index ${i} references unknown dialogueId "${npc.dialogueId}"`,
        );
      }
    }

    const hasValidX = validateGridCoordinate(
      npc.x,
      width,
      diagnostics,
      data,
      `${path}.x`,
      `npc at index ${i} has an invalid x coordinate`,
    );
    const hasValidY = validateGridCoordinate(
      npc.y,
      height,
      diagnostics,
      data,
      `${path}.y`,
      `npc at index ${i} has an invalid y coordinate`,
    );

    if (hasValidX && hasValidY && tiles) {
      const npcX = npc.x as number;
      const npcY = npc.y as number;

      if (isKnownTileWalkable(tiles, npcX, npcY, context) === false) {
        addZoneError(
          diagnostics,
          data,
          path,
          `npc at index ${i} must spawn on a walkable tile`,
        );
      }
    }

    if (npc.schedule !== undefined) {
      validateNpcSchedule(
        npc.schedule,
        i,
        data,
        width,
        height,
        tiles,
        diagnostics,
        context,
      );
    }
  }
}

function validateItems(
  data: Record<string, unknown>,
  playerStart: { x: number; y: number } | undefined,
  width: number | undefined,
  height: number | undefined,
  tiles: unknown[][] | undefined,
  diagnostics: ContentDiagnostic[],
  context: ZoneValidationContext,
): void {
  if (data.items === undefined) {
    return;
  }

  if (!Array.isArray(data.items)) {
    addZoneError(diagnostics, data, "items", "items must be an array");
    return;
  }

  for (let i = 0; i < data.items.length; i++) {
    const item = data.items[i];
    const path = `items[${i}]`;

    if (!isRecord(item)) {
      addZoneError(diagnostics, data, path, `item at index ${i} must be an object`);
      continue;
    }

    if (typeof item.itemId !== "string" || !item.itemId.trim()) {
      addZoneError(
        diagnostics,
        data,
        `${path}.itemId`,
        `item at index ${i} has invalid or missing itemId`,
      );
    } else if (!context.itemIds.has(item.itemId)) {
      addZoneError(
        diagnostics,
        data,
        `${path}.itemId`,
        `item at index ${i} references unknown itemId "${item.itemId}"`,
      );
    }

    const hasValidX = validateGridCoordinate(
      item.x,
      width,
      diagnostics,
      data,
      `${path}.x`,
      `item at index ${i} has an invalid x coordinate`,
    );
    const hasValidY = validateGridCoordinate(
      item.y,
      height,
      diagnostics,
      data,
      `${path}.y`,
      `item at index ${i} has an invalid y coordinate`,
    );

    if (
      typeof item.quantity !== "number" ||
      !Number.isInteger(item.quantity) ||
      item.quantity < 1
    ) {
      addZoneError(
        diagnostics,
        data,
        `${path}.quantity`,
        `item at index ${i} has an invalid quantity (must be a positive integer)`,
      );
    }

    if (hasValidX && hasValidY && tiles) {
      const itemX = item.x as number;
      const itemY = item.y as number;

      if (isKnownTileWalkable(tiles, itemX, itemY, context) === false) {
        addZoneError(
          diagnostics,
          data,
          path,
          `item at index ${i} must spawn on a walkable tile`,
        );
      }
    }

    if (
      hasValidX &&
      hasValidY &&
      playerStart &&
      (item.x as number) === playerStart.x &&
      (item.y as number) === playerStart.y
    ) {
      addZoneError(
        diagnostics,
        data,
        path,
        `item at index ${i} must not spawn on the player start`,
      );
    }

    const overlappingNpcIndex =
      hasValidX && hasValidY
        ? findOverlappingNpcIndex(data.npcs, item.x as number, item.y as number)
        : -1;

    if (overlappingNpcIndex >= 0) {
      addZoneError(
        diagnostics,
        data,
        path,
        `item at index ${i} must not spawn on npc at index ${overlappingNpcIndex}`,
      );
    }
  }
}

function validateGridCoordinate(
  value: unknown,
  limit: number | undefined,
  diagnostics: ContentDiagnostic[],
  data: Record<string, unknown>,
  path: string,
  message: string,
): value is number {
  if (
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    value < 0 ||
    (limit !== undefined && value >= limit)
  ) {
    addZoneError(diagnostics, data, path, message);
    return false;
  }

  return true;
}

function isCoordinateInBounds(
  x: number,
  y: number,
  width: number | undefined,
  height: number | undefined,
): boolean {
  return (
    width !== undefined &&
    height !== undefined &&
    x >= 0 &&
    y >= 0 &&
    x < width &&
    y < height
  );
}

function isKnownTileWalkable(
  tiles: unknown[][],
  x: number,
  y: number,
  context: ZoneValidationContext,
): boolean | undefined {
  const tileId = getKnownTileIdAt(tiles, x, y, context);

  if (tileId === undefined) {
    return undefined;
  }

  return context.tileDefs.get(tileId)?.walkable;
}

function getKnownTileIdAt(
  tiles: unknown[][],
  x: number,
  y: number,
  context: ZoneValidationContext,
): number | undefined {
  const row = tiles[y];

  if (!Array.isArray(row)) {
    return undefined;
  }

  const tileId = row[x];

  if (
    typeof tileId !== "number" ||
    !Number.isInteger(tileId) ||
    !context.tileDefs.has(tileId)
  ) {
    return undefined;
  }

  return tileId;
}

function validateDialogueNodes(
  value: unknown,
  context: string,
  path: string,
  data: Record<string, unknown>,
  diagnostics: ContentDiagnostic[],
): void {
  if (!Array.isArray(value)) {
    addZoneError(diagnostics, data, path, `${context} must be an array`);
    return;
  }

  if (value.length === 0) {
    addZoneError(
      diagnostics,
      data,
      path,
      `${context} array must contain at least one node`,
    );
  }

  for (let i = 0; i < value.length; i++) {
    const node = value[i];
    const nodePath = `${path}[${i}]`;

    if (!isRecord(node)) {
      addZoneError(
        diagnostics,
        data,
        nodePath,
        `${context} node ${i} must be an object`,
      );
      continue;
    }

    if (typeof node.speaker !== "string" || !node.speaker.trim()) {
      addZoneError(
        diagnostics,
        data,
        `${nodePath}.speaker`,
        `${context} node ${i} has invalid or missing speaker`,
      );
    }

    if (typeof node.text !== "string" || !node.text.trim()) {
      addZoneError(
        diagnostics,
        data,
        `${nodePath}.text`,
        `${context} node ${i} has invalid or missing text`,
      );
    }

    if (
      typeof node.pitch !== "number" ||
      !Number.isFinite(node.pitch) ||
      node.pitch < 0.1
    ) {
      addZoneError(
        diagnostics,
        data,
        `${nodePath}.pitch`,
        `${context} node ${i} has invalid or missing pitch`,
      );
    }
  }
}

function validateNpcSchedule(
  value: unknown,
  npcIndex: number,
  zone: Record<string, unknown>,
  width: number | undefined,
  height: number | undefined,
  tiles: unknown[][] | undefined,
  diagnostics: ContentDiagnostic[],
  context: ZoneValidationContext,
): void {
  const path = `npcs[${npcIndex}].schedule`;

  if (!Array.isArray(value)) {
    addZoneError(
      diagnostics,
      zone,
      path,
      `npc at index ${npcIndex} schedule must be an array`,
    );
    return;
  }

  if (value.length === 0) {
    addZoneError(
      diagnostics,
      zone,
      path,
      `npc at index ${npcIndex} schedule must contain entries`,
    );
  }

  const currentZoneId = typeof zone.zoneId === "string" ? zone.zoneId : undefined;

  for (let i = 0; i < value.length; i++) {
    const entry = value[i];
    const entryPath = `${path}[${i}]`;

    if (!isRecord(entry)) {
      addZoneError(
        diagnostics,
        zone,
        entryPath,
        `npc at index ${npcIndex} schedule entry ${i} must be an object`,
      );
      continue;
    }

    if (
      typeof entry.time !== "string" ||
      parseScheduleTime(entry.time) === undefined
    ) {
      addZoneError(
        diagnostics,
        zone,
        `${entryPath}.time`,
        `npc at index ${npcIndex} schedule entry ${i} has invalid time`,
      );
    }

    if (
      entry.zoneId !== undefined &&
      (typeof entry.zoneId !== "string" || !entry.zoneId.trim())
    ) {
      addZoneError(
        diagnostics,
        zone,
        `${entryPath}.zoneId`,
        `npc at index ${npcIndex} schedule entry ${i} has invalid zoneId`,
      );
    }

    const isLocalEntry = isLocalScheduleEntry(entry.zoneId, currentZoneId);
    const hasValidX = validateGridCoordinate(
      entry.x,
      isLocalEntry ? width : undefined,
      diagnostics,
      zone,
      `${entryPath}.x`,
      `npc at index ${npcIndex} schedule entry ${i} has an invalid x coordinate`,
    );
    const hasValidY = validateGridCoordinate(
      entry.y,
      isLocalEntry ? height : undefined,
      diagnostics,
      zone,
      `${entryPath}.y`,
      `npc at index ${npcIndex} schedule entry ${i} has an invalid y coordinate`,
    );

    if (isLocalEntry && hasValidX && hasValidY && tiles) {
      const entryX = entry.x as number;
      const entryY = entry.y as number;

      if (isKnownTileWalkable(tiles, entryX, entryY, context) === false) {
        addZoneError(
          diagnostics,
          zone,
          entryPath,
          `npc at index ${npcIndex} schedule entry ${i} must target a walkable tile`,
        );
      }
    }

    if (entry.dialogueId !== undefined) {
      if (
        typeof entry.dialogueId !== "string" ||
        !context.dialogueIds.has(entry.dialogueId)
      ) {
        addZoneError(
          diagnostics,
          zone,
          `${entryPath}.dialogueId`,
          `npc at index ${npcIndex} schedule entry ${i} has an unknown dialogueId "${entry.dialogueId}"`,
        );
      }
    }
  }
}

function isLocalScheduleEntry(
  zoneId: unknown,
  currentZoneId: string | undefined,
): boolean {
  return zoneId === undefined || zoneId === currentZoneId;
}

function findOverlappingNpcIndex(
  npcs: unknown,
  x: number,
  y: number,
): number {
  if (!Array.isArray(npcs)) {
    return -1;
  }

  return npcs.findIndex(
    (npc) => isRecord(npc) && npc.x === x && npc.y === y,
  );
}
