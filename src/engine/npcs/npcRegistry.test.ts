import { describe, expect, it } from "vitest";
import {
  getNpcDef,
  hasNpcDef,
  validateNpcDef,
  validateNpcRegistry,
} from "./npcRegistry";

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

describe("validateNpcDef", () => {
  const context = { dialogueIds: new Set(["hero.default"]) };

  it("accepts a valid definition against an injected context", () => {
    expect(
      validateNpcDef(
        {
          npcId: "hero",
          name: "Hero",
          race: "human",
          defaultDialogueId: "hero.default",
        },
        context,
      ),
    ).toEqual([]);
  });

  it("accumulates several errors with precise paths", () => {
    const diagnostics = validateNpcDef(
      {
        npcId: "broken_npc",
        name: "",
        race: "dragon",
        importance: "legend",
        presentation: { glyph: "ab", color: "" },
        defaultDialogueId: "missing.dialogue",
      },
      context,
    );

    expect(diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          contentType: "npc",
          contentId: "broken_npc",
          path: "name",
        }),
        expect.objectContaining({ path: "race" }),
        expect.objectContaining({ path: "importance" }),
        expect.objectContaining({ path: "presentation.glyph" }),
        expect.objectContaining({ path: "presentation.color" }),
        expect.objectContaining({
          path: "defaultDialogueId",
          message:
            'NPC definition "broken_npc" references unknown defaultDialogueId "missing.dialogue".',
        }),
      ]),
    );
    expect(diagnostics).toHaveLength(6);
  });
});

describe("validateNpcRegistry", () => {
  it("reports duplicate npc ids", () => {
    const def = {
      npcId: "hero",
      name: "Hero",
      race: "human",
      defaultDialogueId: "hero.default",
    };

    expect(
      validateNpcRegistry([def, def], {
        dialogueIds: new Set(["hero.default"]),
      }),
    ).toEqual([
      expect.objectContaining({
        contentId: "hero",
        path: "npcId",
        message: 'Duplicate NPC definition "hero".',
      }),
    ]);
  });
});
