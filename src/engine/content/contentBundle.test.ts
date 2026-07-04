import { describe, expect, it } from "vitest";
import gameConfigData from "../../content/game.json";
import { getTileDef } from "../TileRegistry";
import {
  defaultContentBundle,
  getDefaultZoneData,
  getNewGameConfig,
  getSafeRespawn,
  getZoneData,
  resolveAllZonesFromBundle,
  resolveZoneFromBundle,
  validateGameConfig,
} from "./contentBundle";

function createGameConfigContext() {
  return {
    itemIds: new Set(["academy_notebook", "travel_ration", "chalk_piece"]),
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
    const config = gameConfigWith({
      safeRespawn: { zoneId: "test_zone", x: 0, y: 0 },
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
    expect(Object.keys(defaultContentBundle.zones).sort()).toEqual([
      "test_zone",
      "test_zone_2",
    ]);
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
    const map = resolveZoneFromBundle(defaultContentBundle, "test_zone");

    expect(map?.zoneId).toBe("test_zone");
    expect(map?.isWalkable(5, 4)).toBe(true);
  });

  it("returns independent zone data and map instances", () => {
    const firstZoneData = getZoneData(defaultContentBundle, "test_zone");
    const secondZoneData = getZoneData(defaultContentBundle, "test_zone");
    const firstMap = resolveZoneFromBundle(defaultContentBundle, "test_zone");
    const secondMap = resolveZoneFromBundle(defaultContentBundle, "test_zone");

    expect(firstZoneData).not.toBe(secondZoneData);
    expect(firstZoneData?.tiles).not.toBe(secondZoneData?.tiles);
    expect(firstMap).not.toBe(secondMap);
  });

  it("exposes a detached new-game config", () => {
    const first = getNewGameConfig(defaultContentBundle);

    expect(first).toMatchObject({
      startingCurrency: 1550,
      maxEnergy: 100,
      startingInventory: [
        { itemId: "academy_notebook", quantity: 1 },
        { itemId: "travel_ration", quantity: 3 },
        { itemId: "chalk_piece", quantity: 2 },
      ],
    });

    first.startingInventory[0].quantity = 99;
    first.attributes.strength = 99;

    const second = getNewGameConfig(defaultContentBundle);
    expect(second.startingInventory[0].quantity).toBe(1);
    expect(second.attributes.strength).toBe(10);
  });
});
