import { describe, expect, it } from "vitest";
import {
  getAllNpcPresenceDefs,
  getNpcPresenceDef,
  hasNpcPresenceDef,
  validateNpcPresenceDef,
  validateNpcPresenceRegistry,
} from "./npcPresenceRegistry";

describe("npcPresenceRegistry", () => {
  it("exposes known NPC presence definitions", () => {
    expect(hasNpcPresenceDef("young_page")).toBe(true);
    expect(getNpcPresenceDef("young_page")).toMatchObject({
      npcId: "young_page",
      schedule: [
        {
          time: "08:00",
          zoneId: "test_zone",
          x: 6,
          y: 3,
          dialogueId: "young_page.quest_start",
        },
        {
          time: "18:00",
          zoneId: "test_zone_2",
          x: 2,
          y: 6,
          dialogueId: "young_page.evening",
        },
      ],
    });
  });

  it("protects registry definitions from external mutation", () => {
    const firstRead = getNpcPresenceDef("young_page")!;
    firstRead.schedule[0].x = 99;

    expect(getNpcPresenceDef("young_page")!.schedule[0].x).toBe(6);
  });

  it("returns all registered presence definitions", () => {
    expect(getAllNpcPresenceDefs().map((def) => def.npcId)).toContain(
      "young_page",
    );
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
