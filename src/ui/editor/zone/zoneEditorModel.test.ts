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
  addNpcScheduleEntry,
  cloneZoneData,
  createBlankZone,
  createZoneDraftSnapshot,
  createZoneDraftValidationContext,
  describeZoneCell,
  erasePlacementsAt,
  isValidScheduleTime,
  listEditorZones,
  placeItemAt,
  placeNpcAt,
  placeTransitionAt,
  removeEntryDialogueNode,
  removeNpcScheduleEntry,
  serializeZoneData,
  setPlayerStart,
  setTileAt,
  updateEntryDialogueNode,
  updateNpcScheduleEntry,
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

const shippedZoneIds = Object.keys(
  createRuntimeContentCatalogSnapshot().zones,
).sort((a, b) => a.localeCompare(b));

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
    npcs: [{ npcId: "npc_a", x: 2, y: 2 }],
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
    const withDialogue = placeNpcAt(zone, 2, 2, "npc_b", "greet");
    expect(withDialogue.npcs).toEqual([
      { npcId: "npc_b", dialogueId: "greet", x: 2, y: 2 },
    ]);

    const withoutDialogue = placeNpcAt(zone, 7, 7, "npc_b");
    expect(withoutDialogue.npcs).toEqual([
      { npcId: "npc_a", x: 2, y: 2 },
      { npcId: "npc_b", x: 7, y: 7 },
    ]);
  });

  it("places an item stack, replacing any stack on the same cell", () => {
    expect(placeItemAt(zone, 3, 3, "item_a", 5).items).toEqual([
      { itemId: "item_a", x: 3, y: 3, quantity: 5 },
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
    expect(validateNewZone(base, ["existing_zone"])).toEqual([]);
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

describe("isValidScheduleTime", () => {
  it("accepts HH:mm 24-hour labels and rejects everything else", () => {
    expect(isValidScheduleTime("00:00")).toBe(true);
    expect(isValidScheduleTime("08:00")).toBe(true);
    expect(isValidScheduleTime("23:59")).toBe(true);

    expect(isValidScheduleTime("8:00")).toBe(false);
    expect(isValidScheduleTime("24:00")).toBe(false);
    expect(isValidScheduleTime("12:60")).toBe(false);
    expect(isValidScheduleTime("")).toBe(false);
    expect(isValidScheduleTime("morning")).toBe(false);
  });
});

describe("npc schedule editing", () => {
  const zone = createZone({
    npcs: [
      { npcId: "npc_a", x: 2, y: 2 },
      {
        npcId: "npc_b",
        x: 5,
        y: 5,
        schedule: [{ time: "08:00", x: 5, y: 5 }],
      },
    ],
  });

  it("adds a default entry to the addressed spawn only", () => {
    const next = addNpcScheduleEntry(zone, 2, 2);
    expect(next.npcs?.[0].schedule).toEqual([{ time: "08:00", x: 2, y: 2 }]);
    // The other spawn's schedule is untouched.
    expect(next.npcs?.[1].schedule).toEqual([{ time: "08:00", x: 5, y: 5 }]);
  });

  it("patches a field of one schedule entry", () => {
    const next = updateNpcScheduleEntry(zone, 5, 5, 0, {
      time: "18:30",
      zoneId: "other",
      dialogueId: "greet",
    });
    expect(next.npcs?.[1].schedule).toEqual([
      { time: "18:30", zoneId: "other", dialogueId: "greet", x: 5, y: 5 },
    ]);
  });

  it("removes an entry and drops the schedule key when it empties", () => {
    const next = removeNpcScheduleEntry(zone, 5, 5, 0);
    expect(next.npcs?.[1].schedule).toBeUndefined();
  });

  it("no-ops (same reference) for an unknown cell or out-of-range index", () => {
    expect(addNpcScheduleEntry(zone, 9, 9)).toBe(zone);
    expect(updateNpcScheduleEntry(zone, 5, 5, 3, { time: "09:00" })).toBe(zone);
    expect(removeNpcScheduleEntry(zone, 2, 2, 0)).toBe(zone);
  });
});

describe("zoneContentPath", () => {
  it("builds the zone JSON path from the zone id", () => {
    expect(zoneContentPath("custom_zone")).toBe(
      "src/content/zones/custom_zone.json",
    );
  });
});

describe("serializeZoneData", () => {
  it.each(shippedZoneIds)(
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
      JSON.parse(readShippedZone(shippedZoneIds[0])) as ZoneData,
    );
    expect(serialized).toMatch(/^\s+\[\d+(, \d+)+\],?$/m);
    // No tile number ever sits alone on its own line.
    expect(serialized).not.toMatch(/^\s+\d+,?$/m);
  });
});

describe("zone draft cross-content validation", () => {
  it("flags a paint that walls a tile a global NPC's schedule walks onto", () => {
    const snapshot = createRuntimeContentCatalogSnapshot();
    const target = findScheduleTarget(snapshot);
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
          diagnostic.contentId === target.npcId &&
          /non-walkable/i.test(diagnostic.message),
      ),
    ).toBe(true);
  });

  it("stays clean when the schedule target keeps its walkable tile", () => {
    const snapshot = createRuntimeContentCatalogSnapshot();
    const target = findScheduleTarget(snapshot);
    const diagnostics = validateAllContent(
      snapshot,
      createRuntimeContentValidationContext(),
    );

    expect(
      diagnostics.some((diagnostic) => diagnostic.contentId === target.npcId),
    ).toBe(false);
  });
});

function findScheduleTarget(snapshot: ContentCatalogSnapshot): {
  npcId: string;
  zoneId: string;
  x: number;
  y: number;
} {
  for (const presence of snapshot.npcPresence) {
    for (const entry of presence.schedule) {
      const zone = entry.zoneId ? snapshot.zones[entry.zoneId] : undefined;
      if (
        zone &&
        entry.x >= 0 &&
        entry.x < zone.width &&
        entry.y >= 0 &&
        entry.y < zone.height &&
        getAllTileDefs().get(zone.tiles[entry.y][entry.x])?.walkable === true
      ) {
        return {
          npcId: presence.npcId,
          zoneId: zone.zoneId,
          x: entry.x,
          y: entry.y,
        };
      }
    }
  }

  const npcId = snapshot.npcs[0]?.npcId;
  const zone = Object.values(snapshot.zones)[0];
  if (!npcId || !zone) {
    throw new Error("expected at least one authored NPC and zone");
  }

  snapshot.npcPresence.push({
    npcId,
    schedule: [
      {
        time: "08:00",
        zoneId: zone.zoneId,
        x: zone.playerStart.x,
        y: zone.playerStart.y,
      },
    ],
  });
  return {
    npcId,
    zoneId: zone.zoneId,
    x: zone.playerStart.x,
    y: zone.playerStart.y,
  };
}

describe("describeZoneCell", () => {
  const zone = createZone({
    width: 5,
    height: 5,
    tiles: [
      [0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0],
    ],
    playerStart: { x: 1, y: 1 },
    npcs: [{ npcId: "npc_a", x: 2, y: 2 }],
    items: [{ itemId: "potion", x: 3, y: 3, quantity: 5 }],
    transitions: [
      { x: 4, y: 4, targetZoneId: "other_zone", targetX: 10, targetY: 20 },
    ],
  });

  it("describes a basic tile with no placement", () => {
    const desc = describeZoneCell(zone, { x: 0, y: 0 });
    expect(desc).toEqual({
      x: 0,
      y: 0,
      tileName: expect.any(String),
      tileGlyph: expect.any(String),
      walkable: expect.any(Boolean),
      whatSitsThere: null,
    });
  });

  it("describes player start position", () => {
    const desc = describeZoneCell(zone, { x: 1, y: 1 });
    expect(desc?.whatSitsThere).toBe("Player Start");
  });

  it("describes npc spawn position", () => {
    const desc = describeZoneCell(zone, { x: 2, y: 2 });
    expect(desc?.whatSitsThere).toBe("NPC: npc_a");
  });

  it("describes item spawn position", () => {
    const desc = describeZoneCell(zone, { x: 3, y: 3 });
    expect(desc?.whatSitsThere).toBe("Item: potion (x5)");
  });

  it("describes transition position", () => {
    const desc = describeZoneCell(zone, { x: 4, y: 4 });
    expect(desc?.whatSitsThere).toBe("Transition: other_zone (10, 20)");
  });

  it("returns null for out-of-bounds cells", () => {
    expect(describeZoneCell(zone, { x: -1, y: 0 })).toBeNull();
    expect(describeZoneCell(zone, { x: 5, y: 0 })).toBeNull();
    expect(describeZoneCell(zone, { x: 0, y: -1 })).toBeNull();
    expect(describeZoneCell(zone, { x: 0, y: 5 })).toBeNull();
  });
});

