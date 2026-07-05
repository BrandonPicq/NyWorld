import { describe, expect, it } from "vitest";
import type {
  ContentCatalogSnapshot,
  NpcDef,
  NpcPresenceDef,
} from "../../../engine";
import {
  addPresenceScheduleEntry,
  createPresenceDefForNpc,
  createPresenceDraftSnapshot,
  defaultPresencePosition,
  listPresenceNpcEntries,
  presenceContentPath,
  removePresenceDef,
  removePresenceScheduleEntry,
  serializePresenceDef,
  serializePresenceDefsById,
  updatePresenceDef,
  updatePresenceScheduleEntry,
  upsertPresenceDef,
} from "./presenceEditorModel";

function createNpcs(): NpcDef[] {
  return [
    {
      npcId: "npc_b",
      name: "NPC B",
      race: "elf",
      defaultDialogueId: "npc_b.default",
    },
    {
      npcId: "npc_a",
      name: "NPC A",
      race: "human",
      defaultDialogueId: "npc_a.default",
    },
  ];
}

function createPresence(): NpcPresenceDef[] {
  return [
    {
      npcId: "npc_a",
      schedule: [{ time: "08:00", zoneId: "zone", x: 1, y: 1 }],
    },
  ];
}

describe("presence editor helpers", () => {
  it("lists every NPC with presence status, sorted, and builds content paths", () => {
    expect(listPresenceNpcEntries(createNpcs(), createPresence())).toEqual([
      { npcId: "npc_a", name: "NPC A", hasPresence: true, entryCount: 1 },
      { npcId: "npc_b", name: "NPC B", hasPresence: false, entryCount: 0 },
    ]);
    expect(presenceContentPath("npc_a")).toBe(
      "src/content/npc-presence/npc_a.json",
    );
  });

  it("creates, upserts, updates, removes, and serializes presence defs", () => {
    const created = createPresenceDefForNpc("npc_b", {
      zoneId: "zone",
      x: 2,
      y: 3,
    });
    expect(created).toEqual({
      npcId: "npc_b",
      schedule: [{ time: "08:00", zoneId: "zone", x: 2, y: 3 }],
    });

    const inserted = upsertPresenceDef(createPresence(), created);
    expect(inserted.map((def) => def.npcId)).toEqual(["npc_a", "npc_b"]);

    const updated = updatePresenceDef(inserted, "npc_a", (def) =>
      updatePresenceScheduleEntry(def, 0, { time: "18:30" }),
    );
    expect(updated[0].schedule[0].time).toBe("18:30");

    const removed = removePresenceDef(updated, "npc_a");
    expect(removed.map((def) => def.npcId)).toEqual(["npc_b"]);
    expect(serializePresenceDef(removed[0])).toContain('"npcId": "npc_b"');
    expect(serializePresenceDefsById(removed).get("npc_b")).toContain(
      '"zoneId": "zone"',
    );
  });

  it("adds and removes schedule entries without mutating the source def", () => {
    const def = createPresence()[0];
    const added = addPresenceScheduleEntry(def, {
      zoneId: "other",
      x: 4,
      y: 5,
    });
    const removed = removePresenceScheduleEntry(added, 0);

    expect(def.schedule).toHaveLength(1);
    expect(added.schedule).toEqual([
      { time: "08:00", zoneId: "zone", x: 1, y: 1 },
      { time: "08:00", zoneId: "other", x: 4, y: 5 },
    ]);
    expect(removed.schedule).toEqual([
      { time: "08:00", zoneId: "other", x: 4, y: 5 },
    ]);
  });

  it("substitutes the draft presence list into a catalog snapshot", () => {
    const snapshot = {
      npcPresence: createPresence(),
      zones: {},
    } as unknown as ContentCatalogSnapshot;
    const draft = upsertPresenceDef(
      snapshot.npcPresence,
      createPresenceDefForNpc("npc_b", { zoneId: "zone", x: 1, y: 1 }),
    );

    const draftSnapshot = createPresenceDraftSnapshot(snapshot, draft);
    expect(draftSnapshot.npcPresence.map((def) => def.npcId)).toEqual([
      "npc_a",
      "npc_b",
    ]);
    // The source snapshot is untouched.
    expect(snapshot.npcPresence).toHaveLength(1);
  });

  it("defaults a new presence position to the first zone's player start", () => {
    const snapshot = {
      zones: {
        zone_b: { playerStart: { x: 9, y: 9 } },
        zone_a: { playerStart: { x: 2, y: 4 } },
      },
    } as unknown as ContentCatalogSnapshot;

    expect(defaultPresencePosition(snapshot)).toEqual({
      zoneId: "zone_a",
      x: 2,
      y: 4,
    });
    expect(defaultPresencePosition({
      zones: {},
    } as unknown as ContentCatalogSnapshot)).toEqual({
      zoneId: "",
      x: 1,
      y: 1,
    });
  });
});
