import { describe, expect, it } from "vitest";
import {
  createRuntimeContentCatalogSnapshot,
  type ContentCatalogSnapshot,
  type ZoneData,
} from "../../engine";
import { resolveEditorPlaytestStart } from "./playtestStart";

describe("resolveEditorPlaytestStart", () => {
  it("starts in the currently selected zone", () => {
    const snapshot = snapshotWithZones({
      defaultZoneId: "default_zone",
      zones: {
        default_zone: zone("default_zone", { x: 1, y: 1 }),
        selected_zone: zone("selected_zone", { x: 3, y: 2 }),
      },
    });

    expect(
      resolveEditorPlaytestStart({
        snapshot,
        selectedZoneId: "selected_zone",
      }),
    ).toEqual({ zoneId: "selected_zone", x: 3, y: 2 });
  });

  it("falls back to the configured default zone when selection is unavailable", () => {
    const snapshot = snapshotWithZones({
      defaultZoneId: "default_zone",
      zones: {
        default_zone: zone("default_zone", { x: 2, y: 1 }),
      },
    });

    expect(
      resolveEditorPlaytestStart({
        snapshot,
        selectedZoneId: "missing_zone",
      }),
    ).toEqual({ zoneId: "default_zone", x: 2, y: 1 });
  });

  it("uses the pinned inspect cell when it is walkable in the selected zone", () => {
    const snapshot = snapshotWithZones({
      defaultZoneId: "default_zone",
      zones: {
        default_zone: zone("default_zone", { x: 1, y: 1 }),
        selected_zone: zone("selected_zone", { x: 1, y: 1 }),
      },
    });

    expect(
      resolveEditorPlaytestStart({
        snapshot,
        selectedZoneId: "selected_zone",
        pinnedInspectCell: { x: 2, y: 1 },
      }),
    ).toEqual({ zoneId: "selected_zone", x: 2, y: 1 });
  });

  it("ignores pinned inspect cells that are blocked or out of bounds", () => {
    const selectedZone = zone("selected_zone", { x: 1, y: 1 });
    selectedZone.tiles[2][2] = 1;
    const snapshot = snapshotWithZones({
      defaultZoneId: "default_zone",
      zones: {
        default_zone: zone("default_zone", { x: 1, y: 1 }),
        selected_zone: selectedZone,
      },
    });

    expect(
      resolveEditorPlaytestStart({
        snapshot,
        selectedZoneId: "selected_zone",
        pinnedInspectCell: { x: 2, y: 2 },
      }),
    ).toEqual({ zoneId: "selected_zone", x: 1, y: 1 });

    expect(
      resolveEditorPlaytestStart({
        snapshot,
        selectedZoneId: "selected_zone",
        pinnedInspectCell: { x: 99, y: 99 },
      }),
    ).toEqual({ zoneId: "selected_zone", x: 1, y: 1 });
  });
});

function snapshotWithZones(input: {
  defaultZoneId: string;
  zones: Record<string, ZoneData>;
}): ContentCatalogSnapshot {
  const snapshot = createRuntimeContentCatalogSnapshot();
  return {
    ...snapshot,
    game: { ...snapshot.game, defaultZoneId: input.defaultZoneId },
    zones: input.zones,
  };
}

function zone(zoneId: string, playerStart: { x: number; y: number }): ZoneData {
  return {
    version: "0.1",
    zoneId,
    name: zoneId,
    width: 4,
    height: 4,
    playerStart,
    tiles: [
      [1, 1, 1, 1],
      [1, 0, 0, 1],
      [1, 0, 0, 1],
      [1, 1, 1, 1],
    ],
    npcs: [],
    items: [],
    transitions: [],
  };
}
