import { describe, expect, it } from "vitest";
import gameConfigData from "../../content/game.json";
import { getAllItemIds } from "../items/itemRegistry";
import { getTileDef } from "../TileRegistry";
import type { ZoneData } from "../ZoneTypes";
import {
  defaultContentBundle,
  type GameContentConfig,
  getDefaultZoneData,
  getNewGameConfig,
  getSafeRespawn,
  getZoneData,
  resolveAllZonesFromBundle,
  resolveZoneFromBundle,
  validateGameConfig,
} from "./contentBundle";

const authoredZones = import.meta.glob<ZoneData>("../../content/zones/*.json", {
  eager: true,
  import: "default",
});
const authoredZoneIds = Object.values(authoredZones)
  .map((zone) => zone.zoneId)
  .sort((a, b) => a.localeCompare(b));

function createGameConfigContext() {
  return {
    itemIds: new Set(getAllItemIds()),
    zones: resolveAllZonesFromBundle(defaultContentBundle),
  };
}

function gameConfigWith(overrides: Record<string, unknown>) {
  return {
    ...structuredClone(gameConfigData),
    ...overrides,
  };
}

describe("validateGameConfig", () => {
  it("accepts the shipped game config", () => {
    expect(
      validateGameConfig(gameConfigData, createGameConfigContext()),
    ).toEqual([]);
  });

  it("accumulates action tuning errors with precise paths", () => {
    const config = gameConfigWith({
      actions: {
        rest: { energyRestore: 0 },
        study: { energyCost: 10, academicProgressGain: -1 },
      },
    });

    const diagnostics = validateGameConfig(config, createGameConfigContext());

    expect(diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: "actions.rest.energyRestore" }),
        expect.objectContaining({
          path: "actions.study.academicProgressGain",
        }),
        expect.objectContaining({ path: "actions.study.intelligenceGain" }),
      ]),
    );
    expect(diagnostics).toHaveLength(3);
  });

  it("requires a newGame section", () => {
    expect(
      validateGameConfig(
        gameConfigWith({ newGame: undefined }),
        createGameConfigContext(),
      ),
    ).toEqual([
      expect.objectContaining({
        contentType: "game",
        path: "newGame",
        message: "Game content config has invalid or missing newGame.",
      }),
    ]);
  });

  it("accumulates new-game errors with precise paths", () => {
    const config = gameConfigWith({
      newGame: {
        startingCurrency: -5,
        maxEnergy: 0,
        startingInventory: [{ itemId: "missing_item", quantity: 0 }],
        attributes: { strength: 10 },
        skills: "none",
      },
    });

    const diagnostics = validateGameConfig(config, createGameConfigContext());

    expect(diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: "newGame.startingCurrency" }),
        expect.objectContaining({ path: "newGame.maxEnergy" }),
        expect.objectContaining({
          path: "newGame.startingInventory[0].itemId",
          message:
            'Starting stack 0 references unknown itemId "missing_item".',
        }),
        expect.objectContaining({
          path: "newGame.startingInventory[0].quantity",
        }),
        expect.objectContaining({ path: "newGame.attributes.vitality" }),
        expect.objectContaining({ path: "newGame.skills" }),
      ]),
    );
  });

  it("rejects an unwalkable safe respawn", () => {
    const blocked = findBlockedCoordinate();
    const config = gameConfigWith({
      safeRespawn: { zoneId: blocked.zoneId, x: blocked.x, y: blocked.y },
    });

    expect(validateGameConfig(config, createGameConfigContext())).toEqual([
      expect.objectContaining({
        path: "safeRespawn",
        message: "Game content safeRespawn must be on a walkable tile.",
      }),
    ]);
  });

  it("rejects an unknown default zone", () => {
    const config = gameConfigWith({ defaultZoneId: "missing_zone" });

    expect(validateGameConfig(config, createGameConfigContext())).toEqual([
      expect.objectContaining({
        path: "defaultZoneId",
        message:
          'Game content references unknown defaultZoneId "missing_zone".',
      }),
    ]);
  });
});

describe("contentBundle", () => {
  it("discovers authored zone content", () => {
    expect(Object.keys(defaultContentBundle.zones).sort()).toEqual(
      authoredZoneIds,
    );
  });

  it("resolves the configured default zone", () => {
    const zoneData = getDefaultZoneData(defaultContentBundle);

    expect(zoneData.zoneId).toBe(defaultContentBundle.game.defaultZoneId);
  });

  it("keeps safe respawn inside an available walkable zone", () => {
    const safeRespawn = getSafeRespawn(defaultContentBundle);
    const zoneData = getZoneData(defaultContentBundle, safeRespawn.zoneId);

    expect(zoneData).toBeDefined();
    expect(safeRespawn.x).toBeGreaterThanOrEqual(0);
    expect(safeRespawn.x).toBeLessThan(zoneData!.width);
    expect(safeRespawn.y).toBeGreaterThanOrEqual(0);
    expect(safeRespawn.y).toBeLessThan(zoneData!.height);
    expect(getTileDef(zoneData!.tiles[safeRespawn.y][safeRespawn.x]).walkable)
      .toBe(true);
  });

  it("resolves zones into runtime maps", () => {
    const zoneId = defaultContentBundle.game.defaultZoneId;
    const zoneData = getZoneData(defaultContentBundle, zoneId)!;
    const map = resolveZoneFromBundle(defaultContentBundle, zoneId);

    expect(map?.zoneId).toBe(zoneId);
    expect(map?.isWalkable(zoneData.playerStart.x, zoneData.playerStart.y))
      .toBe(true);
  });

  it("returns independent zone data and map instances", () => {
    const zoneId = defaultContentBundle.game.defaultZoneId;
    const firstZoneData = getZoneData(defaultContentBundle, zoneId);
    const secondZoneData = getZoneData(defaultContentBundle, zoneId);
    const firstMap = resolveZoneFromBundle(defaultContentBundle, zoneId);
    const secondMap = resolveZoneFromBundle(defaultContentBundle, zoneId);

    expect(firstZoneData).not.toBe(secondZoneData);
    expect(firstZoneData?.tiles).not.toBe(secondZoneData?.tiles);
    expect(firstMap).not.toBe(secondMap);
  });

  it("exposes a detached new-game config", () => {
    const authoredNewGame = (gameConfigData as GameContentConfig).newGame;
    const first = getNewGameConfig(defaultContentBundle);

    expect(first).toEqual(authoredNewGame);

    first.startingInventory.push({ itemId: "debug_item", quantity: 99 });
    first.attributes.strength = 99;

    const second = getNewGameConfig(defaultContentBundle);
    expect(second.startingInventory).toEqual(authoredNewGame.startingInventory);
    expect(second.attributes.strength).toBe(authoredNewGame.attributes.strength);
  });
});

function findBlockedCoordinate(): { zoneId: string; x: number; y: number } {
  for (const zone of Object.values(defaultContentBundle.zones)) {
    for (let y = 0; y < zone.tiles.length; y++) {
      for (let x = 0; x < zone.tiles[y].length; x++) {
        if (!getTileDef(zone.tiles[y][x]).walkable) {
          return { zoneId: zone.zoneId, x, y };
        }
      }
    }
  }

  throw new Error("expected shipped zones to contain a blocked tile");
}
