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
  addEntryDialogueNode,
  cloneZoneData,
  createBlankZone,
  createZoneDraftSnapshot,
  createZoneDraftValidationContext,
  erasePlacementsAt,
  listEditorZones,
  placeItemAt,
  placeNpcAt,
  placeTransitionAt,
  removeEntryDialogueNode,
  serializeZoneData,
  setPlayerStart,
  setTileAt,
  updateEntryDialogueNode,
  validateNewZone,
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

describe("placement editing", () => {
  const zone = createZone({
    playerStart: { x: 1, y: 1 },
    npcs: [{ npcId: "old_scholar", x: 2, y: 2 }],
    items: [{ itemId: "old_coin", x: 3, y: 3, quantity: 1 }],
    transitions: [
      { x: 4, y: 4, targetZoneId: "other", targetX: 0, targetY: 0 },
    ],
  });

  it("moves the player start and no-ops when unchanged", () => {
    expect(setPlayerStart(zone, 5, 6).playerStart).toEqual({ x: 5, y: 6 });
    expect(setPlayerStart(zone, 1, 1)).toBe(zone);
  });

  it("places an NPC, replacing any spawn on the same cell", () => {
    const withDialogue = placeNpcAt(zone, 2, 2, "old_wizard", "greet");
    expect(withDialogue.npcs).toEqual([
      { npcId: "old_wizard", dialogueId: "greet", x: 2, y: 2 },
    ]);

    const withoutDialogue = placeNpcAt(zone, 7, 7, "old_wizard");
    expect(withoutDialogue.npcs).toEqual([
      { npcId: "old_scholar", x: 2, y: 2 },
      { npcId: "old_wizard", x: 7, y: 7 },
    ]);
  });

  it("places an item stack, replacing any stack on the same cell", () => {
    expect(placeItemAt(zone, 3, 3, "chalk_piece", 5).items).toEqual([
      { itemId: "chalk_piece", x: 3, y: 3, quantity: 5 },
    ]);
  });

  it("places a transition, replacing any transition on the same cell", () => {
    expect(placeTransitionAt(zone, 4, 4, "dest", 2, 3).transitions).toEqual([
      { x: 4, y: 4, targetZoneId: "dest", targetX: 2, targetY: 3 },
    ]);
  });

  it("erases every placement on a cell and no-ops on an empty cell", () => {
    const erased = erasePlacementsAt(
      placeItemAt(zone, 2, 2, "old_coin", 1),
      2,
      2,
    );
    expect(erased.npcs).toEqual([]);
    expect(erased.items).toEqual([{ itemId: "old_coin", x: 3, y: 3, quantity: 1 }]);

    expect(erasePlacementsAt(zone, 9, 9)).toBe(zone);
  });

  it("does not introduce empty arrays when erasing", () => {
    const tilesOnly = createZone({ playerStart: { x: 1, y: 1 } });
    expect(erasePlacementsAt(tilesOnly, 0, 0)).toBe(tilesOnly);
    expect(erasePlacementsAt(tilesOnly, 0, 0).items).toBeUndefined();
  });
});

describe("validateNewZone", () => {
  const base = { zoneId: "cave", name: "Cave", width: 6, height: 5 };

  it("accepts a fresh slug id with a valid grid", () => {
    expect(validateNewZone(base, ["test_zone"])).toEqual([]);
  });

  it("rejects blank, malformed, or duplicate ids", () => {
    expect(validateNewZone({ ...base, zoneId: "" }, [])).toContain(
      "Zone id is required.",
    );
    expect(validateNewZone({ ...base, zoneId: "Bad Id" }, [])).toContain(
      "Zone id must be lowercase letters, digits, or underscores.",
    );
    expect(validateNewZone(base, ["cave"])).toContain(
      'Zone "cave" already exists.',
    );
  });

  it("requires a name and a grid of at least 3x3", () => {
    expect(validateNewZone({ ...base, name: " " }, [])).toContain(
      "Name is required.",
    );
    expect(validateNewZone({ ...base, width: 2 }, [])).toContain(
      "Width must be an integer of at least 3.",
    );
    expect(validateNewZone({ ...base, height: 2.5 }, [])).toContain(
      "Height must be an integer of at least 3.",
    );
  });
});

describe("createBlankZone", () => {
  it("builds a floor-filled grid with a wall border and a walkable start", () => {
    const zone = createBlankZone(
      { zoneId: "cave", name: "Cave", width: 4, height: 3 },
      0,
      1,
    );

    expect(zone).toMatchObject({
      version: "0.1",
      zoneId: "cave",
      name: "Cave",
      width: 4,
      height: 3,
      playerStart: { x: 1, y: 1 },
    });
    expect(zone.tiles).toEqual([
      [1, 1, 1, 1],
      [1, 0, 0, 1],
      [1, 1, 1, 1],
    ]);
    // The player start sits on a floor tile.
    expect(zone.tiles[zone.playerStart.y][zone.playerStart.x]).toBe(0);
  });
});

describe("entry dialogue editing", () => {
  it("adds a blank line, patches fields, and removes lines", () => {
    const zone = createZone({ playerStart: { x: 1, y: 1 } });

    const added = addEntryDialogueNode(zone);
    expect(added.entryDialogue).toEqual([
      { speaker: "", text: "", pitch: 1 },
    ]);

    const patched = updateEntryDialogueNode(added, 0, {
      speaker: "Narrator",
      text: "Hello.",
      pitch: 0.8,
    });
    expect(patched.entryDialogue).toEqual([
      { speaker: "Narrator", text: "Hello.", pitch: 0.8 },
    ]);

    // Removing the last line drops the key entirely.
    expect(removeEntryDialogueNode(patched, 0).entryDialogue).toBeUndefined();
  });

  it("ignores out-of-range indexes", () => {
    const zone = addEntryDialogueNode(createZone({ playerStart: { x: 1, y: 1 } }));
    expect(updateEntryDialogueNode(zone, 5, { speaker: "x" })).toBe(zone);
    expect(removeEntryDialogueNode(zone, -1)).toBe(zone);
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
