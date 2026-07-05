import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  createRuntimeContentCatalogSnapshot,
  createRuntimeContentValidationContext,
  getAllTileDefs,
  validateAllContent,
  type ContentCatalogSnapshot,
  type ZoneData,
} from "../../../engine";
import {
  cloneZoneData,
  createZoneDraftSnapshot,
  createZoneDraftValidationContext,
  listEditorZones,
  serializeZoneData,
  setTileAt,
  zoneContentPath,
} from "./zoneEditorModel";

function firstBlockedTileId(): number {
  const blocked = [...getAllTileDefs().entries()].find(
    ([, def]) => !def.walkable,
  );
  if (!blocked) throw new Error("expected a non-walkable tile in the catalog");
  return blocked[0];
}

function readShippedZone(zoneId: string): string {
  return readFileSync(
    new URL(`../../../content/zones/${zoneId}.json`, import.meta.url),
    "utf8",
  );
}

function createZone(overrides: Partial<ZoneData>): ZoneData {
  return {
    version: "0.1",
    zoneId: "zone",
    name: "Zone",
    width: 3,
    height: 3,
    playerStart: { x: 1, y: 1 },
    tiles: [[0]],
    ...overrides,
  };
}

function createSnapshot(zones: ZoneData[]): ContentCatalogSnapshot {
  return {
    zones: Object.fromEntries(zones.map((zone) => [zone.zoneId, zone])),
  } as ContentCatalogSnapshot;
}

describe("listEditorZones", () => {
  it("sorts zones by id and counts placements, defaulting missing arrays to 0", () => {
    const snapshot = createSnapshot([
      createZone({
        zoneId: "zone_b",
        name: "Zone B",
        npcs: [
          { npcId: "a", x: 0, y: 0 },
          { npcId: "b", x: 1, y: 1 },
        ],
        items: [{ itemId: "x", x: 2, y: 2, quantity: 1 }],
        transitions: [
          { x: 0, y: 0, targetZoneId: "zone_a", targetX: 1, targetY: 1 },
        ],
      }),
      createZone({ zoneId: "zone_a", name: "Zone A" }),
    ]);

    expect(listEditorZones(snapshot)).toEqual([
      {
        zoneId: "zone_a",
        name: "Zone A",
        npcCount: 0,
        itemCount: 0,
        transitionCount: 0,
      },
      {
        zoneId: "zone_b",
        name: "Zone B",
        npcCount: 2,
        itemCount: 1,
        transitionCount: 1,
      },
    ]);
  });
});

describe("setTileAt", () => {
  const zone = createZone({
    width: 3,
    height: 2,
    tiles: [
      [0, 0, 0],
      [0, 0, 0],
    ],
  });

  it("returns a new zone with the target tile changed, leaving the source intact", () => {
    const next = setTileAt(zone, 1, 1, 5);

    expect(next).not.toBe(zone);
    expect(next.tiles).toEqual([
      [0, 0, 0],
      [0, 5, 0],
    ]);
    // Source zone is untouched.
    expect(zone.tiles[1][1]).toBe(0);
  });

  it("returns the same reference for a no-op paint or out-of-bounds cell", () => {
    expect(setTileAt(zone, 1, 1, 0)).toBe(zone);
    expect(setTileAt(zone, 3, 0, 5)).toBe(zone);
    expect(setTileAt(zone, 0, 2, 5)).toBe(zone);
    expect(setTileAt(zone, -1, 0, 5)).toBe(zone);
  });
});

describe("zoneContentPath", () => {
  it("builds the zone JSON path from the zone id", () => {
    expect(zoneContentPath("test_zone")).toBe(
      "src/content/zones/test_zone.json",
    );
  });
});

describe("serializeZoneData", () => {
  it.each(["test_zone", "test_zone_2"])(
    "round-trips the shipped %s.json byte-for-byte",
    (zoneId) => {
      const raw = readShippedZone(zoneId);
      const zone = JSON.parse(raw) as ZoneData;
      // The endpoint owns the trailing newline; the serializer does not add it.
      expect(serializeZoneData(zone) + "\n").toBe(raw);
    },
  );

  it("keeps each tiles row on a single line and never explodes a tile", () => {
    const serialized = serializeZoneData(
      JSON.parse(readShippedZone("test_zone")) as ZoneData,
    );
    expect(serialized).toContain("    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1],");
    // No tile number ever sits alone on its own line.
    expect(serialized).not.toMatch(/^\s+\d+,?$/m);
  });
});

describe("zone draft cross-content validation", () => {
  it("flags a paint that walls a tile a global NPC's schedule walks onto", () => {
    const snapshot = createRuntimeContentCatalogSnapshot();
    // young_page's 18:00 schedule enters test_zone_2 at (2, 6).
    const target = { zoneId: "test_zone_2", x: 2, y: 6 };
    const draft = setTileAt(
      cloneZoneData(snapshot.zones[target.zoneId]),
      target.x,
      target.y,
      firstBlockedTileId(),
    );

    const diagnostics = validateAllContent(
      createZoneDraftSnapshot(snapshot, draft),
      createZoneDraftValidationContext(
        createRuntimeContentValidationContext(),
        draft,
      ),
    );

    expect(
      diagnostics.some(
        (diagnostic) =>
          diagnostic.contentId === "young_page" &&
          /non-walkable/i.test(diagnostic.message),
      ),
    ).toBe(true);
  });

  it("stays clean when the schedule target keeps its walkable tile", () => {
    const snapshot = createRuntimeContentCatalogSnapshot();
    const diagnostics = validateAllContent(
      snapshot,
      createRuntimeContentValidationContext(),
    );

    expect(
      diagnostics.some((diagnostic) => diagnostic.contentId === "young_page"),
    ).toBe(false);
  });
});
