import { GameMap } from "./GameMap";
import { hasItemDef } from "./items/itemRegistry";
import { hasNpcDef } from "./npcs/npcRegistry";
import { getTileDef, hasTileDef } from "./TileRegistry";
import type { ZoneData, ZoneTransitionData } from "./ZoneTypes";

export class ZoneLoadError extends Error {
  constructor(message: string) {
    super(`Invalid zone data: ${message}`);
    this.name = "ZoneLoadError";
  }
}

/**
 * Validates raw zone content and converts it into a runtime GameMap.
 *
 * Keep validation here so imported JSON never reaches gameplay systems with
 * unknown tile ids, invalid spawn positions, or malformed dialogue.
 */
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

  if (
    typeof data.width !== "number" ||
    !Number.isInteger(data.width) ||
    data.width < 1
  ) {
    throw new ZoneLoadError("width must be a positive integer");
  }

  if (
    typeof data.height !== "number" ||
    !Number.isInteger(data.height) ||
    data.height < 1
  ) {
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

      if (!hasTileDef(row[x])) {
        throw new ZoneLoadError(`unknown tile id ${row[x]} at (${x}, ${y})`);
      }
    }
  }

  const startTileId = data.tiles[data.playerStart.y][data.playerStart.x];

  if (!getTileDef(startTileId).walkable) {
    throw new ZoneLoadError("playerStart must be on a walkable tile");
  }

  if (data.transitions !== undefined) {
    if (!Array.isArray(data.transitions)) {
      throw new ZoneLoadError("transitions must be an array");
    }

    for (let i = 0; i < data.transitions.length; i++) {
      const t = data.transitions[i];

      if (!isRecord(t)) {
        throw new ZoneLoadError(`transition at index ${i} must be an object`);
      }

      if (
        typeof t.x !== "number" ||
        !Number.isInteger(t.x) ||
        t.x < 0 ||
        t.x >= data.width
      ) {
        throw new ZoneLoadError(`transition at index ${i} has an invalid x`);
      }

      if (
        typeof t.y !== "number" ||
        !Number.isInteger(t.y) ||
        t.y < 0 ||
        t.y >= data.height
      ) {
        throw new ZoneLoadError(`transition at index ${i} has an invalid y`);
      }

      if (typeof t.targetZoneId !== "string") {
        throw new ZoneLoadError(
          `transition at index ${i} is missing a valid targetZoneId`,
        );
      }

      if (typeof t.targetX !== "number" || !Number.isInteger(t.targetX)) {
        throw new ZoneLoadError(`transition at index ${i} has an invalid targetX`);
      }

      if (typeof t.targetY !== "number" || !Number.isInteger(t.targetY)) {
        throw new ZoneLoadError(`transition at index ${i} has an invalid targetY`);
      }

      const transitionTileId = data.tiles[t.y][t.x];

      if (!getTileDef(transitionTileId).walkable) {
        throw new ZoneLoadError(
          `transition at index ${i} must be on a walkable tile`,
        );
      }
    }
  }

  if (data.entryDialogue !== undefined) {
    validateDialogueNodes(data.entryDialogue, "entryDialogue");
  }

  if (data.npcs !== undefined) {
    if (!Array.isArray(data.npcs)) {
      throw new ZoneLoadError("npcs must be an array");
    }

    for (let i = 0; i < data.npcs.length; i++) {
      const npc = data.npcs[i];

      if (!isRecord(npc)) {
        throw new ZoneLoadError(`npc at index ${i} must be an object`);
      }

      if (typeof npc.npcId !== "string" || !npc.npcId.trim()) {
        throw new ZoneLoadError(`npc at index ${i} has invalid or missing npcId`);
      }

      if (!hasNpcDef(npc.npcId)) {
        throw new ZoneLoadError(
          `npc at index ${i} references unknown npcId "${npc.npcId}"`,
        );
      }

      if (
        typeof npc.x !== "number" ||
        !Number.isInteger(npc.x) ||
        npc.x < 0 ||
        npc.x >= data.width
      ) {
        throw new ZoneLoadError(`npc at index ${i} has an invalid x coordinate`);
      }

      if (
        typeof npc.y !== "number" ||
        !Number.isInteger(npc.y) ||
        npc.y < 0 ||
        npc.y >= data.height
      ) {
        throw new ZoneLoadError(`npc at index ${i} has an invalid y coordinate`);
      }

      const npcTileId = data.tiles[npc.y][npc.x];
      if (!getTileDef(npcTileId).walkable) {
        throw new ZoneLoadError(`npc at index ${i} must spawn on a walkable tile`);
      }
    }
  }

  if (data.items !== undefined) {
    if (!Array.isArray(data.items)) {
      throw new ZoneLoadError("items must be an array");
    }

    for (let i = 0; i < data.items.length; i++) {
      const item = data.items[i];

      if (!isRecord(item)) {
        throw new ZoneLoadError(`item at index ${i} must be an object`);
      }

      if (typeof item.itemId !== "string" || !item.itemId.trim()) {
        throw new ZoneLoadError(`item at index ${i} has invalid or missing itemId`);
      }

      if (!hasItemDef(item.itemId)) {
        throw new ZoneLoadError(
          `item at index ${i} references unknown itemId "${item.itemId}"`,
        );
      }

      if (
        typeof item.x !== "number" ||
        !Number.isInteger(item.x) ||
        item.x < 0 ||
        item.x >= data.width
      ) {
        throw new ZoneLoadError(`item at index ${i} has an invalid x coordinate`);
      }

      if (
        typeof item.y !== "number" ||
        !Number.isInteger(item.y) ||
        item.y < 0 ||
        item.y >= data.height
      ) {
        throw new ZoneLoadError(`item at index ${i} has an invalid y coordinate`);
      }

      if (
        typeof item.quantity !== "number" ||
        !Number.isInteger(item.quantity) ||
        item.quantity < 1
      ) {
        throw new ZoneLoadError(
          `item at index ${i} has an invalid quantity (must be a positive integer)`,
        );
      }

      const itemTileId = data.tiles[item.y][item.x];
      if (!getTileDef(itemTileId).walkable) {
        throw new ZoneLoadError(
          `item at index ${i} must spawn on a walkable tile`,
        );
      }

      if (item.x === data.playerStart.x && item.y === data.playerStart.y) {
        throw new ZoneLoadError(
          `item at index ${i} must not spawn on the player start`,
        );
      }

      const overlappingNpcIndex = Array.isArray(data.npcs)
        ? data.npcs.findIndex(
            (npc) =>
              isRecord(npc) &&
              npc.x === item.x &&
              npc.y === item.y,
          )
        : -1;

      if (overlappingNpcIndex >= 0) {
        throw new ZoneLoadError(
          `item at index ${i} must not spawn on npc at index ${overlappingNpcIndex}`,
        );
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
    Number.isInteger(value.x) &&
    typeof value.y === "number" &&
    Number.isInteger(value.y)
  );
}

function validateDialogueNodes(value: unknown, context: string): void {
  if (!Array.isArray(value)) {
    throw new ZoneLoadError(`${context} must be an array`);
  }

  if (value.length === 0) {
    throw new ZoneLoadError(`${context} array must contain at least one node`);
  }

  for (let i = 0; i < value.length; i++) {
    const node = value[i];

    if (!isRecord(node)) {
      throw new ZoneLoadError(`${context} node ${i} must be an object`);
    }

    if (typeof node.speaker !== "string" || !node.speaker.trim()) {
      throw new ZoneLoadError(
        `${context} node ${i} has invalid or missing speaker`,
      );
    }

    if (typeof node.text !== "string" || !node.text.trim()) {
      throw new ZoneLoadError(`${context} node ${i} has invalid or missing text`);
    }

    if (
      typeof node.pitch !== "number" ||
      !Number.isFinite(node.pitch) ||
      node.pitch < 0.1
    ) {
      throw new ZoneLoadError(
        `${context} node ${i} has invalid or missing pitch`,
      );
    }
  }
}
