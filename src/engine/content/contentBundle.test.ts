import { describe, expect, it } from "vitest";
import { getTileDef } from "../TileRegistry";
import {
  defaultContentBundle,
  getDefaultZoneData,
  getSafeRespawn,
  getZoneData,
  resolveZoneFromBundle,
} from "./contentBundle";

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
});
