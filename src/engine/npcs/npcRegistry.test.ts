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
      defaultDialogueId: "old_scholar.default",
    });
  });

  it("returns a fallback for unknown NPC definitions", () => {
    expect(hasNpcDef("missing_npc")).toBe(false);
    expect(getNpcDef("missing_npc")).toMatchObject({
      npcId: "unknown_npc",
      name: "Unknown NPC",
      race: "unknown",
      defaultDialogueId: "unknown_npc.default",
    });
  });

  it("protects registry definitions from external mutation", () => {
    const firstRead = getNpcDef("old_scholar");
    firstRead.presentation!.color = "#000000";

    expect(getNpcDef("old_scholar").presentation!.color).toBe("#ffb000");
  });
});
