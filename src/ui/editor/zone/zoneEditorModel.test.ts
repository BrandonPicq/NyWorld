import { describe, expect, it } from "vitest";
import type { ContentCatalogSnapshot, ZoneData } from "../../../engine";
import { listEditorZones } from "./zoneEditorModel";

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
