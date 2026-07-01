import { describe, expect, it } from "vitest";
import testZoneData from "../content/zones/test_zone.json";
import testZone2Data from "../content/zones/test_zone_2.json";
import { ZoneLoadError, loadZone } from "./zoneLoader";

const validZoneData = {
  version: "0.1",
  zoneId: "test_zone",
  name: "Test Zone",
  width: 3,
  height: 3,
  playerStart: { x: 1, y: 1 },
  tiles: [
    [1, 1, 1],
    [1, 0, 1],
    [1, 1, 1],
  ],
};

const validNpc = {
  npcId: "scholar",
  name: "Old Scholar",
  glyph: "S",
  color: "#ffcc00",
  x: 2,
  y: 1,
  dialogue: [{ speaker: "Old Scholar", text: "Welcome!", pitch: 0.9 }],
};

const validEntryDialogue = [
  { speaker: "Narrator", text: "The road opens before you.", pitch: 1 },
];

function zoneDataWith(overrides: Record<string, unknown>) {
  return {
    ...validZoneData,
    playerStart: { ...validZoneData.playerStart },
    tiles: validZoneData.tiles.map((row) => [...row]),
    ...overrides,
  };
}

describe("loadZone", () => {
  it("accepts valid zone data", () => {
    const map = loadZone(validZoneData);

    expect(map.zoneId).toBe("test_zone");
    expect(map.width).toBe(3);
    expect(map.height).toBe(3);
    expect(map.isWalkable(1, 1)).toBe(true);
  });

  it("accepts the current test content zones", () => {
    expect(() => loadZone(testZoneData)).not.toThrow();
    expect(() => loadZone(testZone2Data)).not.toThrow();
  });

  it("accepts entry dialogue nodes", () => {
    const map = loadZone(
      zoneDataWith({
        entryDialogue: validEntryDialogue,
      }),
    );

    expect(map.entryDialogue).toEqual(validEntryDialogue);
  });

  it("rejects empty entry dialogue arrays", () => {
    expect(() =>
      loadZone(
        zoneDataWith({
          entryDialogue: [],
        }),
      ),
    ).toThrow("entryDialogue array must contain at least one node");
  });

  it("rejects invalid entry dialogue pitch values", () => {
    expect(() =>
      loadZone(
        zoneDataWith({
          entryDialogue: [
            {
              speaker: "Narrator",
              text: "Something feels wrong.",
              pitch: Number.NaN,
            },
          ],
        }),
      ),
    ).toThrow("entryDialogue node 0 has invalid or missing pitch");
  });

  it("rejects unknown tile ids", () => {
    const tiles = validZoneData.tiles.map((row) => [...row]);
    tiles[1][1] = 99;

    expect(() => loadZone(zoneDataWith({ tiles }))).toThrow(ZoneLoadError);
    expect(() => loadZone(zoneDataWith({ tiles }))).toThrow(
      "unknown tile id 99 at (1, 1)",
    );
  });

  it("rejects non-integer player starts", () => {
    expect(() =>
      loadZone(zoneDataWith({ playerStart: { x: 1.5, y: 1 } })),
    ).toThrow("missing or invalid playerStart");
  });

  it("rejects player starts on blocked tiles", () => {
    expect(() =>
      loadZone(zoneDataWith({ playerStart: { x: 0, y: 0 } })),
    ).toThrow("playerStart must be on a walkable tile");
  });

  it("accepts transitions on walkable tiles", () => {
    const map = loadZone(
      zoneDataWith({
        transitions: [
          {
            targetX: 1,
            targetY: 1,
            targetZoneId: "next_zone",
            x: 1,
            y: 1,
          },
        ],
      }),
    );

    expect(map.getTransitionAt(1, 1)).toEqual({
      targetX: 1,
      targetY: 1,
      targetZoneId: "next_zone",
      x: 1,
      y: 1,
    });
  });

  it("rejects transitions on blocked tiles", () => {
    expect(() =>
      loadZone(
        zoneDataWith({
          transitions: [
            {
              targetX: 1,
              targetY: 1,
              targetZoneId: "next_zone",
              x: 0,
              y: 0,
            },
          ],
        }),
      ),
    ).toThrow("transition at index 0 must be on a walkable tile");
  });

  it("accepts NPCs on walkable tiles with dialogue nodes", () => {
    const map = loadZone(
      zoneDataWith({
        height: 4,
        width: 4,
        tiles: [
          [1, 1, 1, 1],
          [1, 0, 0, 1],
          [1, 0, 0, 1],
          [1, 1, 1, 1],
        ],
        npcs: [validNpc],
      }),
    );

    expect(map.npcs).toEqual([validNpc]);
  });

  it("rejects NPCs without dialogue nodes", () => {
    expect(() =>
      loadZone(
        zoneDataWith({
          height: 4,
          width: 4,
          tiles: [
            [1, 1, 1, 1],
            [1, 0, 0, 1],
            [1, 0, 0, 1],
            [1, 1, 1, 1],
          ],
          npcs: [{ ...validNpc, dialogue: [] }],
        }),
      ),
    ).toThrow("npc at index 0 dialogue array must contain at least one node");
  });

  it("rejects NPCs on blocked tiles", () => {
    expect(() =>
      loadZone(
        zoneDataWith({
          npcs: [{ ...validNpc, x: 0, y: 0 }],
        }),
      ),
    ).toThrow("npc at index 0 must spawn on a walkable tile");
  });
});
