import { describe, expect, it } from "vitest";
import {
  getAllNpcPresenceDefs,
  getNpcPresenceDef,
  hasNpcPresenceDef,
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
