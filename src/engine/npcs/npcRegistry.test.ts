import { afterEach, describe, expect, it } from "vitest";
import {
  clearNpcContentOverlay,
  getAllNpcDefs,
  getNpcDef,
  hasNpcDef,
  installNpcContentOverlay,
  validateNpcDef,
  validateNpcRegistry,
} from "./npcRegistry";

describe("npcRegistry", () => {
  afterEach(() => {
    clearNpcContentOverlay();
  });

  it("exposes authored NPC character sheets", () => {
    const defs = getAllNpcDefs();

    expect(defs.length).toBeGreaterThan(0);
    for (const def of defs) {
      expect(hasNpcDef(def.npcId)).toBe(true);
      expect(getNpcDef(def.npcId)).toEqual(def);
    }
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
    const authored = getAllNpcDefs()[0];
    const firstRead = getNpcDef(authored.npcId);
    firstRead.name = "Changed outside the registry.";
    if (firstRead.presentation) {
      firstRead.presentation.color = "#000000";
    }

    expect(getNpcDef(authored.npcId)).toEqual(authored);
  });

  it("serves detached draft NPC definitions from a dev content overlay", () => {
    const shipped = getAllNpcDefs()[0];
    const draft = { ...shipped, name: "Draft NPC" };

    installNpcContentOverlay([draft]);

    expect(getAllNpcDefs()).toEqual([draft]);
    expect(hasNpcDef(draft.npcId)).toBe(true);
    expect(getNpcDef(draft.npcId).name).toBe("Draft NPC");

    const firstRead = getNpcDef(draft.npcId);
    firstRead.name = "Mutated";
    expect(getNpcDef(draft.npcId).name).toBe("Draft NPC");

    expect(getNpcDef("missing_overlay_npc")).toMatchObject({
      npcId: "unknown_npc",
      name: "Unknown NPC",
      defaultDialogueId: "unknown_npc.default",
    });

    clearNpcContentOverlay();
    expect(getNpcDef(shipped.npcId)).toEqual(shipped);
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
