import { describe, expect, it } from "vitest";
import {
  buildContentReferenceGraph,
  type ContentCatalogSnapshot,
  type ContentValidationContext,
  type DialogueDefMap,
  type GameMap,
} from "../../../engine";
import {
  addDialogueFile,
  addDialogueNode,
  addDialogueToFile,
  cloneDialogueFiles,
  createDialogueDraftSnapshot,
  createDialogueDraftValidationContext,
  dialogueContentPath,
  flattenDialogueFiles,
  listDialogueFiles,
  removeDialogueFromFile,
  removeDialogueNode,
  replaceDialogueNodes,
  serializeDialogueFile,
  suggestDialogueId,
  updateDialogueNode,
  validateNewDialogueFileStem,
  validateNewDialogueId,
} from "./dialogueEditorModel";

function createDialogueFiles(): Record<string, DialogueDefMap> {
  return {
    old_wizard: {
      "old_wizard.default": [
        { speaker: "Old Wizard", text: "Hocus Pocus!", pitch: 1.2 },
      ],
    },
    old_scholar: {
      "old_scholar.default": [
        { speaker: "Old Scholar", text: "Greetings.", pitch: 0.75 },
      ],
    },
  };
}

function createSnapshot(): ContentCatalogSnapshot {
  const dialogueFiles = createDialogueFiles();
  return {
    game: {
      defaultZoneId: "zone",
      safeRespawn: { zoneId: "zone", x: 1, y: 1 },
      actions: {
        rest: { energyRestore: 15 },
        study: { energyCost: 10, academicProgressGain: 15, intelligenceGain: 1 },
      },
      newGame: {
        startingCurrency: 0,
        maxEnergy: 100,
        startingInventory: [],
        attributes: {
          strength: 1,
          vitality: 1,
          agility: 1,
          intelligence: 1,
          spirit: 1,
          willpower: 1,
          perception: 1,
          charisma: 1,
        },
        skills: {
          melee: 0,
          ranged: 0,
          guard: 0,
          evasion: 0,
          spellcasting: 0,
          focus: 0,
          athletics: 0,
          scholarship: 0,
          speech: 0,
        },
      },
    },
    zones: {},
    items: {},
    npcs: [
      {
        npcId: "old_wizard",
        name: "Old Wizard",
        race: "human",
        importance: "story",
        defaultDialogueId: "old_wizard.default",
      },
    ],
    npcPresence: [],
    enemies: [],
    quests: [],
    combatActions: [],
    dialogues: {
      "unknown_npc.default": [
        { speaker: "Narrator", text: "There is nothing to say yet.", pitch: 1 },
      ],
      ...flattenDialogueFiles(dialogueFiles),
    },
    dialogueFiles,
    tiles: new Map(),
  };
}

function createValidationContext(): ContentValidationContext {
  return {
    itemIds: new Set(),
    npcIds: new Set(["old_wizard"]),
    dialogueIds: new Set([
      "unknown_npc.default",
      "old_wizard.default",
      "old_scholar.default",
    ]),
    enemyIds: new Set(),
    questIds: new Set(),
    combatActionIds: new Set(),
    tileDefs: new Map(),
    zones: new Map([["zone", {} as GameMap]]),
  };
}

describe("dialogue file helpers", () => {
  it("lists dialogue files deterministically and builds content paths", () => {
    expect(listDialogueFiles(createDialogueFiles())).toEqual([
      { stem: "old_scholar", dialogueCount: 1 },
      { stem: "old_wizard", dialogueCount: 1 },
    ]);
    expect(dialogueContentPath("old_wizard")).toBe(
      "src/content/dialogues/old_wizard.json",
    );
  });

  it("clones and flattens dialogue files without sharing nodes", () => {
    const files = createDialogueFiles();
    const clone = cloneDialogueFiles(files);
    clone.old_wizard["old_wizard.default"][0].text = "Changed.";

    expect(files.old_wizard["old_wizard.default"][0].text).toBe(
      "Hocus Pocus!",
    );
    expect(Object.keys(flattenDialogueFiles(files))).toEqual([
      "old_scholar.default",
      "old_wizard.default",
    ]);
  });

  it("validates new file stems and dialogue ids", () => {
    const files = createDialogueFiles();

    expect(validateNewDialogueFileStem("new_npc", files)).toEqual([]);
    expect(validateNewDialogueFileStem("Bad Stem", files)).toContain(
      "File stem must be lowercase letters, digits, or underscores.",
    );
    expect(validateNewDialogueFileStem("old_wizard", files)).toContain(
      'Dialogue file "old_wizard" already exists.',
    );

    expect(validateNewDialogueId("new_npc.default", files)).toEqual([]);
    expect(validateNewDialogueId("new npc.default", files)).toContain(
      "Dialogue id must use lowercase letters, digits, underscores, and dot-separated segments.",
    );
    expect(validateNewDialogueId("old_wizard.default", files)).toContain(
      'Dialogue "old_wizard.default" already exists.',
    );
  });
});

describe("dialogue draft helpers", () => {
  it("adds files and dialogue ids with blank editable nodes", () => {
    const withFile = addDialogueFile(createDialogueFiles(), "young_page");
    const withDialogue = addDialogueToFile(
      withFile,
      "young_page",
      suggestDialogueId("young_page"),
    );

    expect(withDialogue.young_page["young_page.default"]).toEqual([
      { speaker: "", text: "", pitch: 1 },
    ]);
  });

  it("edits dialogue nodes without mutating the original array", () => {
    const nodes = [{ speaker: "A", text: "B", pitch: 1 }];
    const added = addDialogueNode(nodes);
    const updated = updateDialogueNode(added, 1, {
      speaker: "Narrator",
      text: "New line.",
    });
    const removed = removeDialogueNode(updated, 0);

    expect(nodes).toEqual([{ speaker: "A", text: "B", pitch: 1 }]);
    expect(removed).toEqual([
      { speaker: "Narrator", text: "New line.", pitch: 1 },
    ]);
  });

  it("replaces and removes dialogue ids in one owning file", () => {
    const files = createDialogueFiles();
    const replaced = replaceDialogueNodes(files, "old_wizard", "old_wizard.default", [
      { speaker: "Wizard", text: "Updated.", pitch: 1 },
    ]);
    const removed = removeDialogueFromFile(
      replaced,
      "old_wizard",
      "old_wizard.default",
    );

    expect(replaced.old_wizard["old_wizard.default"][0].text).toBe("Updated.");
    expect(removed.old_wizard["old_wizard.default"]).toBeUndefined();
  });

  it("uses draft dialogue ids for dangling-reference checks", () => {
    const snapshot = createSnapshot();
    const draftFiles = removeDialogueFromFile(
      snapshot.dialogueFiles,
      "old_wizard",
      "old_wizard.default",
    );
    const draftSnapshot = createDialogueDraftSnapshot(snapshot, draftFiles);
    const draftContext = createDialogueDraftValidationContext(
      createValidationContext(),
      snapshot,
      draftFiles,
    );

    const danglingReferences =
      buildContentReferenceGraph(draftSnapshot).getDanglingReferences(
        draftContext,
      );

    expect(draftSnapshot.dialogues["unknown_npc.default"]).toBeDefined();
    expect(draftContext.dialogueIds.has("old_wizard.default")).toBe(false);
    expect(danglingReferences).toContainEqual(
      expect.objectContaining({
        from: { type: "npc", id: "old_wizard" },
        to: { type: "dialogue", id: "old_wizard.default" },
        path: "defaultDialogueId",
      }),
    );
  });

  it("serializes one dialogue file as plain two-space JSON", () => {
    expect(serializeDialogueFile(createDialogueFiles().old_wizard)).toContain(
      '  "old_wizard.default": [',
    );
  });
});
