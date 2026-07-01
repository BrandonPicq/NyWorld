import { describe, expect, it } from "vitest";
import { getNpcDef, hasNpcDef } from "./npcRegistry";

describe("npcRegistry", () => {
  it("exposes known NPC character sheets", () => {
    expect(hasNpcDef("old_scholar")).toBe(true);
    expect(getNpcDef("old_scholar")).toMatchObject({
      npcId: "old_scholar",
      name: "Old Scholar",
      race: "human",
      importance: "story",
      presentation: { glyph: "S", color: "#ffb000" },
    });
  });

  it("returns a fallback for unknown NPC definitions", () => {
    expect(hasNpcDef("missing_npc")).toBe(false);
    expect(getNpcDef("missing_npc")).toMatchObject({
      npcId: "unknown_npc",
      name: "Unknown NPC",
      race: "unknown",
    });
  });

  it("protects registry dialogue from external mutation", () => {
    const firstRead = getNpcDef("old_wizard");
    firstRead.dialogue[0].text = "Changed outside the registry.";

    expect(getNpcDef("old_wizard").dialogue[0].text).toBe(
      "Hocus Pocus! I am an adjacent Wizard.",
    );
  });
});
