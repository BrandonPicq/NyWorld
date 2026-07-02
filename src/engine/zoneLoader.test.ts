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
    [1, 0, 0],
    [1, 1, 1],
  ],
};

const validNpc = {
  npcId: "old_scholar",
  x: 2,
  y: 1,
};

const validEntryDialogue = [
  { speaker: "Narrator", text: "The road opens before you.", pitch: 1 },
];

const validItem = {
  itemId: "chalk_piece",
  x: 2,
  y: 1,
  quantity: 1,
};

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

  it("accepts NPC placements on walkable tiles with known npcIds", () => {
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

  it("accepts NPC placements with known dialogue overrides", () => {
    const npcWithDialogue = {
      ...validNpc,
      dialogueId: "old_scholar.test_fields",
    };
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
        npcs: [npcWithDialogue],
      }),
    );

    expect(map.npcs).toEqual([npcWithDialogue]);
  });

  it("accepts NPC placements with schedule entries", () => {
    const npcWithSchedule = {
      ...validNpc,
      schedule: [
        { time: "08:00", x: 2, y: 1 },
        { time: "18:00", x: 1, y: 2 },
      ],
    };
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
        npcs: [npcWithSchedule],
      }),
    );

    expect(map.npcs).toEqual([npcWithSchedule]);
  });

  it("rejects NPC placements with unknown npcIds", () => {
    expect(() =>
      loadZone(
        zoneDataWith({
          npcs: [{ ...validNpc, npcId: "missing_npc" }],
        }),
      ),
    ).toThrow('npc at index 0 references unknown npcId "missing_npc"');
  });

  it("rejects NPC placements without npcIds", () => {
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
          npcs: [{ x: 2, y: 1 }],
        }),
      ),
    ).toThrow("npc at index 0 has invalid or missing npcId");
  });

  it("rejects NPC placements with unknown dialogue overrides", () => {
    expect(() =>
      loadZone(
        zoneDataWith({
          npcs: [{ ...validNpc, dialogueId: "missing.dialogue" }],
        }),
      ),
    ).toThrow('npc at index 0 references unknown dialogueId "missing.dialogue"');
  });

  it("rejects NPC placements with invalid dialogue overrides", () => {
    expect(() =>
      loadZone(
        zoneDataWith({
          npcs: [{ ...validNpc, dialogueId: "" }],
        }),
      ),
    ).toThrow("npc at index 0 has invalid dialogueId");
  });

  it("rejects NPC schedules with invalid times", () => {
    expect(() =>
      loadZone(
        zoneDataWith({
          npcs: [
            {
              ...validNpc,
              schedule: [{ time: "24:00", x: 2, y: 1 }],
            },
          ],
        }),
      ),
    ).toThrow("npc at index 0 schedule entry 0 has invalid time");
  });

  it("rejects NPC schedules with invalid zoneIds", () => {
    expect(() =>
      loadZone(
        zoneDataWith({
          npcs: [
            {
              ...validNpc,
              schedule: [{ time: "18:00", zoneId: "", x: 2, y: 1 }],
            },
          ],
        }),
      ),
    ).toThrow("npc at index 0 schedule entry 0 has invalid zoneId");
  });

  it("rejects NPC schedules targeting blocked tiles", () => {
    expect(() =>
      loadZone(
        zoneDataWith({
          npcs: [
            {
              ...validNpc,
              schedule: [{ time: "18:00", x: 0, y: 0 }],
            },
          ],
        }),
      ),
    ).toThrow("npc at index 0 schedule entry 0 must target a walkable tile");
  });

  it("rejects NPC schedules with unknown dialogueId", () => {
    expect(() =>
      loadZone(
        zoneDataWith({
          npcs: [
            {
              ...validNpc,
              schedule: [{ time: "18:00", x: 2, y: 1, dialogueId: "unknown_dialogue" }],
            },
          ],
        }),
      ),
    ).toThrow('npc at index 0 schedule entry 0 has an unknown dialogueId "unknown_dialogue"');
  });

  it("accepts NPC schedules with a known dialogueId", () => {
    const map = loadZone(
      zoneDataWith({
        npcs: [
          {
            ...validNpc,
            schedule: [{ time: "18:00", x: 2, y: 1, dialogueId: "old_scholar.default" }],
          },
        ],
      }),
    );
    expect(map.npcs[0].schedule?.[0].dialogueId).toBe("old_scholar.default");
  });

  it("accepts NPC schedules targeting another zone", () => {
    const map = loadZone(
      zoneDataWith({
        npcs: [
          {
            ...validNpc,
            schedule: [
              {
                time: "18:00",
                zoneId: "another_zone",
                x: 10,
                y: 10,
                dialogueId: "old_scholar.default",
              },
            ],
          },
        ],
      }),
    );

    expect(map.npcs[0].schedule?.[0]).toMatchObject({
      time: "18:00",
      zoneId: "another_zone",
      x: 10,
      y: 10,
    });
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

  it("accepts items on walkable tiles with a known itemId", () => {
    const map = loadZone(zoneDataWith({ items: [validItem] }));

    expect(map.items).toEqual([validItem]);
  });

  it("rejects items with an unknown itemId", () => {
    expect(() =>
      loadZone(
        zoneDataWith({
          items: [{ ...validItem, itemId: "no_such_item" }],
        }),
      ),
    ).toThrow('item at index 0 references unknown itemId "no_such_item"');
  });

  it("rejects items on blocked tiles", () => {
    expect(() =>
      loadZone(zoneDataWith({ items: [{ ...validItem, x: 0, y: 0 }] })),
    ).toThrow("item at index 0 must spawn on a walkable tile");
  });

  it("rejects items on the player start", () => {
    expect(() =>
      loadZone(zoneDataWith({ items: [{ ...validItem, x: 1, y: 1 }] })),
    ).toThrow("item at index 0 must not spawn on the player start");
  });

  it("rejects items on NPCs", () => {
    expect(() =>
      loadZone(
        zoneDataWith({
          items: [validItem],
          npcs: [validNpc],
        }),
      ),
    ).toThrow("item at index 0 must not spawn on npc at index 0");
  });
});
