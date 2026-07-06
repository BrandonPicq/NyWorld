import { describe, expect, it } from "vitest";
import {
  createRuntimeContentCatalogSnapshot,
  createRuntimeContentValidationContext,
  validateAllContent,
  type QuestDef,
} from "../../../engine";
import {
  addObjective,
  addQuestOverride,
  addRewardItem,
  createObjective,
  createQuestDef,
  createQuestDraftSnapshot,
  createQuestDraftValidationContext,
  listQuestDefs,
  moveObjective,
  nextObjectiveId,
  questContentPath,
  removeObjectiveAt,
  removeQuestOverride,
  removeRewardItem,
  setObjectiveType,
  setQuestOverride,
  setQuestTrigger,
  setRewardCurrency,
  updateObjectiveAt,
  updateQuestDef,
  upsertQuestDef,
  validateNewQuestId,
} from "./questEditorModel";

function sampleQuest(overrides: Partial<QuestDef> = {}): QuestDef {
  return {
    questId: "sample",
    name: "Sample",
    description: "",
    targetNpcId: "npc_a",
    triggers: {
      start: { dialogueId: "d.start" },
      complete: { dialogueId: "d.done" },
    },
    npcOverrides: {},
    objectives: [],
    rewards: {},
    ...overrides,
  };
}

describe("validateNewQuestId", () => {
  it("requires a fresh slug id", () => {
    expect(validateNewQuestId("lost_ring", [])).toEqual([]);
    expect(validateNewQuestId("", [])).toContain("Quest id is required.");
    expect(validateNewQuestId("Bad Id", [])).toContain(
      "Quest id must be lowercase letters, digits, or underscores.",
    );
    expect(validateNewQuestId("sample", [sampleQuest()])).toContain(
      'Quest "sample" already exists.',
    );
  });
});

describe("quest editing helpers", () => {
  it("creates, upserts, updates, and lists quests without mutating sources", () => {
    const created = createQuestDef({ questId: "new_quest", name: "New" });
    expect(created.objectives).toEqual([]);
    expect(created.triggers.start.dialogueId).toBe("");

    const quests = upsertQuestDef([sampleQuest()], created);
    expect(listQuestDefs(quests).map((entry) => entry.questId)).toEqual([
      "new_quest",
      "sample",
    ]);

    const base = [sampleQuest()];
    const updated = updateQuestDef(base, "sample", (quest) =>
      setQuestTrigger(quest, "start", "d.other"),
    );
    expect(updated[0].triggers.start.dialogueId).toBe("d.other");
    expect(base[0].triggers.start.dialogueId).toBe("d.start");
  });

  it("edits overrides and drops empty fields", () => {
    const withOverride = addQuestOverride(sampleQuest(), "npc_b");
    expect(withOverride.npcOverrides.npc_b).toEqual({});

    const patched = setQuestOverride(withOverride, "npc_b", {
      active: "d.active",
      completed: "",
    });
    expect(patched.npcOverrides.npc_b).toEqual({ active: "d.active" });

    expect(
      removeQuestOverride(patched, "npc_b").npcOverrides.npc_b,
    ).toBeUndefined();
  });

  it("edits rewards and drops the currency and items when emptied", () => {
    const withReward = setRewardCurrency(
      addRewardItem(sampleQuest(), "item_a"),
      50,
    );
    expect(withReward.rewards).toEqual({
      currency: 50,
      items: [{ itemId: "item_a", quantity: 1 }],
    });

    const cleared = removeRewardItem(
      setRewardCurrency(withReward, undefined),
      0,
    );
    expect(cleared.rewards).toEqual({});
  });

  it("builds the quest content path", () => {
    expect(questContentPath("lost_ring")).toBe(
      "src/content/quests/lost_ring.json",
    );
  });
});

describe("quest objective editing", () => {
  it("adds objectives with unique ids and switches type keeping id/description", () => {
    const one = addObjective(sampleQuest(), "fetch_item");
    expect(one.objectives).toHaveLength(1);
    expect(one.objectives[0]).toMatchObject({
      type: "fetch_item",
      id: "objective_1",
      quantity: 1,
    });

    const two = addObjective(one, "defeat_npc");
    expect(nextObjectiveId(two)).toBe("objective_3");

    const described = updateObjectiveAt(one, 0, { description: "Collect it" });
    const switched = setObjectiveType(described, 0, "visit_coordinate");
    expect(switched.objectives[0]).toMatchObject({
      type: "visit_coordinate",
      id: "objective_1",
      description: "Collect it",
      x: 0,
      y: 0,
    });
  });

  it("patches a field, removes, and reorders objectives", () => {
    const base = addObjective(addObjective(sampleQuest(), "fetch_item"), "defeat_npc");
    const patched = updateObjectiveAt(base, 0, { quantity: 3 });
    expect(patched.objectives[0]).toMatchObject({ quantity: 3 });

    const moved = moveObjective(base, 0, 1);
    expect(moved.objectives.map((objective) => objective.type)).toEqual([
      "defeat_npc",
      "fetch_item",
    ]);

    const removed = removeObjectiveAt(base, 0);
    expect(removed.objectives.map((objective) => objective.type)).toEqual([
      "defeat_npc",
    ]);
  });

  it("defaults a stat_threshold objective to an accepted stat name", () => {
    const objective = createObjective("stat_threshold", "obj");
    const quest = updateObjectiveAt(
      { ...sampleQuest(), objectives: [objective] },
      0,
      { threshold: 5 },
    );
    // The default stat name must pass quest stat-path validation (no error).
    expect(
      validateAllContent(
        createQuestDraftSnapshot(
          createRuntimeContentCatalogSnapshot(),
          [quest],
        ),
        createQuestDraftValidationContext(
          createRuntimeContentValidationContext(),
          [quest],
        ),
      ).some(
        (diagnostic) =>
          diagnostic.contentId === "sample" &&
          /statName/i.test(diagnostic.path),
      ),
    ).toBe(false);
  });
});

describe("quest draft substitution", () => {
  it("audits a draft quest against the whole bundle", () => {
    const snapshot = createRuntimeContentCatalogSnapshot();
    const context = createRuntimeContentValidationContext();
    const broken: QuestDef = {
      questId: "dangling_quest",
      name: "Dangling",
      description: "",
      targetNpcId: "definitely_missing_npc",
      triggers: {
        start: { dialogueId: "also_missing" },
        complete: { dialogueId: "also_missing" },
      },
      npcOverrides: {},
      objectives: [],
      rewards: {},
    };
    const draftQuests = [...snapshot.quests, broken];

    const diagnostics = validateAllContent(
      createQuestDraftSnapshot(snapshot, draftQuests),
      createQuestDraftValidationContext(context, draftQuests),
    );

    expect(
      diagnostics.some(
        (diagnostic) => diagnostic.contentId === "dangling_quest",
      ),
    ).toBe(true);
  });
});
