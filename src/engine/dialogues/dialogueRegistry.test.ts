import { describe, expect, it } from "vitest";
import {
  getDialogue,
  hasDialogue,
  validateDialogueFile,
  validateDialogueRegistry,
} from "./dialogueRegistry";

describe("dialogueRegistry", () => {
  it("exposes known dialogue definitions", () => {
    expect(hasDialogue("old_scholar.test_fields")).toBe(true);
    expect(getDialogue("old_scholar.test_fields")).toEqual([
      {
        speaker: "Old Scholar",
        text: "Greetings, apprentice. I am researching the history of these ancient fields.",
        pitch: 0.75,
      },
      {
        speaker: "Old Scholar",
        text: "They say that to the East, beyond the threshold, lies a colder land.",
        pitch: 0.75,
      },
    ]);
  });

  it("protects dialogue nodes from external mutation", () => {
    const firstRead = getDialogue("old_wizard.default");
    firstRead[0].text = "Changed outside the registry.";

    expect(getDialogue("old_wizard.default")[0].text).toBe(
      "Hocus Pocus! I am an adjacent Wizard.",
    );
  });

  it("returns fallback dialogue for unknown ids", () => {
    expect(hasDialogue("unknown_npc.default")).toBe(true);
    expect(hasDialogue("missing.dialogue")).toBe(false);
    expect(getDialogue("missing.dialogue")).toEqual([
      {
        speaker: "Narrator",
        text: "There is nothing to say yet.",
        pitch: 1,
      },
    ]);
  });
});

describe("validateDialogueFile", () => {
  it("accepts a valid dialogue file", () => {
    expect(
      validateDialogueFile({
        "hero.greeting": [{ speaker: "Hero", text: "Hello.", pitch: 1 }],
      }),
    ).toEqual([]);
  });

  it("accumulates node errors with precise paths", () => {
    const diagnostics = validateDialogueFile({
      "hero.broken": [
        { speaker: "", text: "Line without a speaker.", pitch: 1 },
        { speaker: "Hero", text: "", pitch: 0 },
      ],
    });

    expect(diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          contentType: "dialogue",
          contentId: "hero.broken",
          path: "[0].speaker",
          message: 'Dialogue "hero.broken" node 0 has invalid speaker.',
        }),
        expect.objectContaining({
          path: "[1].text",
          message: 'Dialogue "hero.broken" node 1 has invalid text.',
        }),
        expect.objectContaining({
          path: "[1].pitch",
          message: 'Dialogue "hero.broken" node 1 has invalid pitch.',
        }),
      ]),
    );
    expect(diagnostics).toHaveLength(3);
  });

  it("rejects empty dialogue sequences", () => {
    expect(validateDialogueFile({ "hero.empty": [] })).toEqual([
      expect.objectContaining({
        contentId: "hero.empty",
        message: 'Dialogue "hero.empty" must contain nodes.',
      }),
    ]);
  });
});

describe("validateDialogueRegistry", () => {
  it("reports duplicate dialogue ids across files", () => {
    const file = {
      "hero.greeting": [{ speaker: "Hero", text: "Hello.", pitch: 1 }],
    };

    expect(validateDialogueRegistry([file, file])).toEqual([
      expect.objectContaining({
        contentId: "hero.greeting",
        message: 'Duplicate dialogue definition "hero.greeting".',
      }),
    ]);
  });
});
