import { describe, expect, it } from "vitest";
import { getDialogue, hasDialogue } from "./dialogueRegistry";

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
