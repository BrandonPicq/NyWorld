import { afterEach, describe, expect, it } from "vitest";
import {
  clearNpcPresenceContentOverlay,
  getAllNpcPresenceDefs,
  getNpcPresenceDef,
  hasNpcPresenceDef,
  installNpcPresenceContentOverlay,
  validateNpcPresenceDef,
  validateNpcPresenceRegistry,
} from "./npcPresenceRegistry";

describe("npcPresenceRegistry", () => {
  afterEach(() => {
    clearNpcPresenceContentOverlay();
  });

  it("exposes authored NPC presence definitions", () => {
    for (const def of getAllNpcPresenceDefs()) {
      expect(hasNpcPresenceDef(def.npcId)).toBe(true);
      expect(getNpcPresenceDef(def.npcId)).toEqual(def);
      expect(def.schedule.length).toBeGreaterThan(0);
    }
  });

  it("protects registry definitions from external mutation", () => {
    const authored = getAllNpcPresenceDefs()[0];
    if (!authored) {
      expect(getAllNpcPresenceDefs()).toEqual([]);
      return;
    }

    const firstRead = getNpcPresenceDef(authored.npcId)!;
    firstRead.schedule[0].x = 99;

    expect(getNpcPresenceDef(authored.npcId)).toEqual(authored);
  });

  it("returns detached copies of all registered presence definitions", () => {
    const firstRead = getAllNpcPresenceDefs();
    const secondRead = getAllNpcPresenceDefs();

    expect(firstRead).toEqual(secondRead);
    expect(firstRead).not.toBe(secondRead);
  });

  it("serves detached draft presence definitions from a dev content overlay", () => {
    const shipped = getAllNpcPresenceDefs()[0];
    if (!shipped) {
      throw new Error("expected at least one shipped presence definition");
    }
    const draft = {
      ...shipped,
      schedule: [{ ...shipped.schedule[0], x: shipped.schedule[0].x + 1 }],
    };

    installNpcPresenceContentOverlay([draft]);

    expect(getAllNpcPresenceDefs()).toEqual([draft]);
    expect(hasNpcPresenceDef(draft.npcId)).toBe(true);
    expect(getNpcPresenceDef(draft.npcId)).toEqual(draft);

    const firstRead = getNpcPresenceDef(draft.npcId)!;
    firstRead.schedule[0].x = 99;
    expect(getNpcPresenceDef(draft.npcId)).toEqual(draft);

    expect(getNpcPresenceDef("missing_overlay_presence")).toBeUndefined();

    clearNpcPresenceContentOverlay();
    expect(getNpcPresenceDef(shipped.npcId)).toEqual(shipped);
  });
});

describe("validateNpcPresenceDef", () => {
  const context = {
    npcIds: new Set(["hero"]),
    dialogueIds: new Set(["hero.default"]),
  };

  it("accepts a valid presence definition against an injected context", () => {
    expect(
      validateNpcPresenceDef(
        {
          npcId: "hero",
          schedule: [
            { time: "08:00", zoneId: "some_zone", x: 1, y: 2 },
            {
              time: "18:00",
              zoneId: "other_zone",
              x: 3,
              y: 4,
              dialogueId: "hero.default",
            },
          ],
        },
        context,
      ),
    ).toEqual([]);
  });

  it("accumulates schedule errors with precise paths", () => {
    const diagnostics = validateNpcPresenceDef(
      {
        npcId: "stranger",
        schedule: [
          { time: "26:99", zoneId: "", x: -1, y: 1.5, dialogueId: "missing" },
        ],
      },
      context,
    );

    expect(diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          contentType: "npc-presence",
          contentId: "stranger",
          path: "npcId",
          message:
            'NPC presence definition references unknown npcId "stranger".',
        }),
        expect.objectContaining({ path: "schedule[0].time" }),
        expect.objectContaining({ path: "schedule[0].zoneId" }),
        expect.objectContaining({ path: "schedule[0].x" }),
        expect.objectContaining({ path: "schedule[0].y" }),
        expect.objectContaining({
          path: "schedule[0].dialogueId",
          message:
            'NPC presence definition "stranger" schedule entry 0 references unknown dialogueId "missing".',
        }),
      ]),
    );
    expect(diagnostics).toHaveLength(6);
  });
});

describe("validateNpcPresenceRegistry", () => {
  it("reports duplicate presence ids", () => {
    const def = {
      npcId: "hero",
      schedule: [{ time: "08:00", zoneId: "some_zone", x: 1, y: 2 }],
    };

    expect(
      validateNpcPresenceRegistry([def, def], {
        npcIds: new Set(["hero"]),
        dialogueIds: new Set(),
      }),
    ).toEqual([
      expect.objectContaining({
        contentId: "hero",
        path: "npcId",
        message: 'Duplicate NPC presence definition "hero".',
      }),
    ]);
  });
});
