import { describe, expect, it } from "vitest";
import {
  createRuntimeContentCatalogSnapshot,
  createRuntimeContentValidationContext,
  validateAllContent,
  type QuestDef,
} from "../../../engine";
import {
  addQuestOverride,
  addRewardItem,
  createQuestDef,
  createQuestDraftSnapshot,
  createQuestDraftValidationContext,
  listQuestDefs,
  questContentPath,
  removeQuestOverride,
  removeRewardItem,
  setQuestOverride,
  setQuestTrigger,
  setRewardCurrency,
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
