import { afterEach, describe, expect, it } from "vitest";
import {
  clearDialogueContentOverlay,
  getDialogueFiles,
  getDialogue,
  hasDialogue,
  installDialogueContentOverlay,
  validateDialogueFile,
  validateDialogueRegistry,
} from "./dialogueRegistry";

describe("dialogueRegistry", () => {
  afterEach(() => {
    clearDialogueContentOverlay();
  });

  it("exposes authored dialogue definitions", () => {
    const dialogue = getFirstEditableDialogue();

    expect(hasDialogue(dialogue.dialogueId)).toBe(true);
    expect(getDialogue(dialogue.dialogueId)).toEqual(dialogue.nodes);
  });

  it("protects dialogue nodes from external mutation", () => {
    const dialogue = getFirstEditableDialogue();
    const firstRead = getDialogue(dialogue.dialogueId);
    firstRead[0].text = "Changed outside the registry.";

    expect(getDialogue(dialogue.dialogueId)).toEqual(dialogue.nodes);
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

  it("exposes detached editable dialogue files without the runtime fallback", () => {
    const dialogue = getFirstEditableDialogue();
    const firstRead = getDialogueFiles();

    expect(firstRead[dialogue.stem][dialogue.dialogueId]).toEqual(
      dialogue.nodes,
    );
    expect(firstRead.unknown_npc).toBeUndefined();

    firstRead[dialogue.stem][dialogue.dialogueId][0].text =
      "Changed outside the registry.";

    expect(getDialogueFiles()[dialogue.stem][dialogue.dialogueId]).toEqual(
      dialogue.nodes,
    );
  });

  it("serves detached draft dialogue files from a dev content overlay", () => {
    const shippedDialogue = getFirstEditableDialogue();

    installDialogueContentOverlay({
      draft: {
        "draft.greeting": [
          { speaker: "Draft", text: "This is a draft line.", pitch: 1.1 },
        ],
      },
    });

    expect(hasDialogue("draft.greeting")).toBe(true);
    expect(getDialogue("draft.greeting")).toEqual([
      { speaker: "Draft", text: "This is a draft line.", pitch: 1.1 },
    ]);
    expect(getDialogueFiles()).toEqual({
      draft: {
        "draft.greeting": [
          { speaker: "Draft", text: "This is a draft line.", pitch: 1.1 },
        ],
      },
    });

    const firstRead = getDialogue("draft.greeting");
    firstRead[0].text = "Mutated.";
    expect(getDialogue("draft.greeting")[0].text).toBe("This is a draft line.");

    expect(getDialogue("missing.overlay")).toEqual([
      {
        speaker: "Narrator",
        text: "There is nothing to say yet.",
        pitch: 1,
      },
    ]);

    clearDialogueContentOverlay();
    expect(hasDialogue("draft.greeting")).toBe(false);
    expect(getDialogue(shippedDialogue.dialogueId)).toEqual(
      shippedDialogue.nodes,
    );
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

function getFirstEditableDialogue() {
  const files = getDialogueFiles();

  for (const stem of Object.keys(files).sort((a, b) => a.localeCompare(b))) {
    const dialogueIds = Object.keys(files[stem]).sort((a, b) =>
      a.localeCompare(b),
    );
    const dialogueId = dialogueIds[0];
    if (dialogueId) {
      return {
        stem,
        dialogueId,
        nodes: files[stem][dialogueId].map((node) => ({ ...node })),
      };
    }
  }

  throw new Error("expected at least one editable dialogue file");
}

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
