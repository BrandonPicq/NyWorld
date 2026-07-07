import { describe, expect, it } from "vitest";
import {
  buildContentReferenceGraph,
  type ContentCatalogSnapshot,
  type ContentValidationContext,
  type DialogueDefMap,
  type GameMap,
  type NpcDef,
} from "../../../engine";
import {
  createDefaultDialogueId,
  addDefaultDialogueForNpc,
  cloneNpcDefs,
  createNpcDef,
  createNpcDraftSnapshot,
  createNpcDraftValidationContext,
  dialogueContentPathForNpc,
  hasDialogueId,
  listNpcDefs,
  npcContentPath,
  removeNpcDef,
  serializeDefaultDialogueFileForNpc,
  serializeNpcDef,
  updateNpcDef,
  upsertNpcDef,
  validateNewNpcId,
  validateNewNpcName,
} from "./npcEditorModel";

function createDialogueFiles(): Record<string, DialogueDefMap> {
  return {
    old_wizard: {
      "old_wizard.default": [
        { speaker: "Old Wizard", text: "Hocus Pocus!", pitch: 1.2 },
      ],
    },
  };
}

function createNpcs(): NpcDef[] {
  return [
    {
      npcId: "old_wizard",
      name: "Old Wizard",
      race: "elf",
      defaultDialogueId: "old_wizard.default",
    },
    {
      npcId: "young_page",
      name: "Young Page",
      race: "human",
      importance: "story",
      defaultDialogueId: "young_page.default",
    },
  ];
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
    npcs: createNpcs(),
    npcPresence: [],
    enemies: [],
    quests: [],
    combatActions: [],
    classes: [],
    races: [],
    dialogues: {
      "unknown_npc.default": [
        { speaker: "Narrator", text: "There is nothing to say yet.", pitch: 1 },
      ],
      "old_wizard.default": dialogueFiles.old_wizard["old_wizard.default"],
    },
    dialogueFiles,
    tiles: new Map(),
  };
}

function createValidationContext(): ContentValidationContext {
  return {
    itemIds: new Set(),
    npcIds: new Set(["old_wizard", "young_page"]),
    dialogueIds: new Set(["unknown_npc.default", "old_wizard.default"]),
    enemyIds: new Set(),
    questIds: new Set(),
    combatActionIds: new Set(),
    classIds: new Set(["otherworlder"]),
    raceIds: new Set(["human"]),
    tileDefs: new Map(),
    zones: new Map([["zone", {} as GameMap]]),
  };
}

describe("NPC editor helpers", () => {
  it("lists NPCs and content paths deterministically", () => {
    expect(listNpcDefs(createNpcs())).toEqual([
      { npcId: "old_wizard", name: "Old Wizard" },
      { npcId: "young_page", name: "Young Page" },
    ]);
    expect(npcContentPath("old_wizard")).toBe(
      "src/content/npcs/old_wizard.json",
    );
    expect(dialogueContentPathForNpc("old_wizard")).toBe(
      "src/content/dialogues/old_wizard.json",
    );
  });

  it("clones, updates, upserts, removes, and serializes NPC definitions", () => {
    const npcs = createNpcs();
    const clone = cloneNpcDefs(npcs);
    clone[0].name = "Changed";

    expect(npcs[0].name).toBe("Old Wizard");

    const updated = updateNpcDef(npcs, "old_wizard", (npc) => ({
      ...npc,
      name: "Wizard",
    }));
    const inserted = upsertNpcDef(
      updated,
      createNpcDef({
        npcId: "new_guard",
        name: "New Guard",
        defaultDialogueId: "old_wizard.default",
      }),
    );
    const removed = removeNpcDef(inserted, "young_page");

    expect(removed.map((npc) => npc.npcId)).toEqual([
      "new_guard",
      "old_wizard",
    ]);
    expect(serializeNpcDef(removed[0])).toContain('"npcId": "new_guard"');
  });

  it("validates new NPC ids and names", () => {
    expect(validateNewNpcId("new_guard", createNpcs())).toEqual([]);
    expect(validateNewNpcId("Bad Id", createNpcs())).toContain(
      "NPC id must be lowercase letters, digits, or underscores.",
    );
    expect(validateNewNpcId("old_wizard", createNpcs())).toContain(
      'NPC "old_wizard" already exists.',
    );

    expect(validateNewNpcName("New Guard")).toEqual([]);
    expect(validateNewNpcName(" ")).toContain("NPC name is required.");
  });

  it("substitutes draft NPC and dialogue ids for reference checks", () => {
    const snapshot = createSnapshot();
    const newNpc = createNpcDef({
      npcId: "new_guard",
      name: "New Guard",
      defaultDialogueId: createDefaultDialogueId("new_guard"),
    });
    const draftNpcs = upsertNpcDef(snapshot.npcs, newNpc);
    const draftDialogueFiles = addDefaultDialogueForNpc(
      snapshot.dialogueFiles,
      newNpc,
    );

    const draftSnapshot = createNpcDraftSnapshot(
      snapshot,
      draftNpcs,
      draftDialogueFiles,
    );
    const draftContext = createNpcDraftValidationContext(
      createValidationContext(),
      snapshot,
      draftNpcs,
      draftDialogueFiles,
    );

    const danglingReferences =
      buildContentReferenceGraph(draftSnapshot).getDanglingReferences(
        draftContext,
      );

    expect(draftContext.npcIds.has("new_guard")).toBe(true);
    expect(draftContext.dialogueIds.has("new_guard.default")).toBe(true);
    expect(draftSnapshot.dialogues["unknown_npc.default"]).toBeDefined();
    expect(danglingReferences).not.toContainEqual(
      expect.objectContaining({
        from: { type: "npc", id: "new_guard" },
        to: { type: "dialogue", id: "new_guard.default" },
      }),
    );
  });

  it("adds and serializes the default dialogue file for a new NPC", () => {
    const snapshot = createSnapshot();
    const newNpc = createNpcDef({
      npcId: "new_guard",
      name: "New Guard",
      defaultDialogueId: createDefaultDialogueId("new_guard"),
    });
    const draftDialogueFiles = addDefaultDialogueForNpc(
      snapshot.dialogueFiles,
      newNpc,
    );

    expect(hasDialogueId(snapshot, draftDialogueFiles, "new_guard.default")).toBe(
      true,
    );
    expect(serializeDefaultDialogueFileForNpc(draftDialogueFiles, "new_guard"))
      .toContain('"speaker": "New Guard"');
  });
});
