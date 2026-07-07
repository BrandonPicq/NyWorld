import { afterEach, describe, expect, it } from "vitest";
import lostNotebookQuestData from "../../content/quests/lost_notebook.json";
import { createRuntimeContentValidationContext } from "../content/runtimeValidationContext";
import type { QuestValidationContext } from "./questRegistry";
import { defaultContentBundle } from "../content/contentBundle";
import { GameplayEngine } from "../GameplayEngine";
import { loadZone } from "../zoneLoader";
import {
  clearQuestContentOverlay,
  getAllQuestDefs,
  getQuestDef,
  hasQuestDef,
  installQuestContentOverlay,
  validateQuestDef,
  validateQuestRegistry,
} from "./questRegistry";
import type { Inventory } from "../components";
import type { QuestDef } from "./QuestDef";

const zoneData = {
  version: "0.1",
  zoneId: "test_zone",
  name: "Quest Test Zone",
  width: 4,
  height: 4,
  playerStart: { x: 1, y: 1 },
  tiles: [
    [1, 1, 1, 1],
    [1, 0, 0, 1],
    [1, 0, 0, 1],
    [1, 1, 1, 1],
  ],
  npcs: [
    {
      npcId: "old_scholar",
      x: 2,
      y: 1,
      dialogueId: "old_scholar.quest_start",
    },
  ],
};

const combatQuestZoneData = {
  version: "0.1",
  zoneId: "combat_quest_zone",
  name: "Combat Quest Zone",
  width: 4,
  height: 4,
  playerStart: { x: 1, y: 1 },
  tiles: [
    [1, 1, 1, 1],
    [1, 0, 0, 1],
    [1, 0, 0, 1],
    [1, 1, 1, 1],
  ],
  npcs: [
    {
      npcId: "slime",
      x: 2,
      y: 1,
    },
  ],
};

function createQuestEngine() {
  return new GameplayEngine(loadZone(zoneData));
}

function createValidationContext(
  overrides: Partial<QuestValidationContext> = {},
): QuestValidationContext {
  const runtimeContext =
    createRuntimeContentValidationContext(defaultContentBundle);

  return {
    itemIds: new Set(runtimeContext.itemIds),
    npcIds: new Set(runtimeContext.npcIds),
    dialogueIds: new Set(runtimeContext.dialogueIds),
    zones: new Map(runtimeContext.zones),
    ...overrides,
  };
}

describe("Quest content validation", () => {
  it("returns no diagnostics for a valid quest", () => {
    expect(validateQuestDef(lostNotebookQuestData, createValidationContext()))
      .toEqual([]);
  });

  it("returns multiple diagnostics with precise paths", () => {
    const diagnostics = validateQuestDef(
      {
        questId: "broken_quest",
        name: "",
        description: "",
        targetNpcId: "missing_npc",
        triggers: {
          start: { dialogueId: "missing.start" },
          complete: {},
        },
        npcOverrides: {
          old_scholar: {
            active: "missing.active",
          },
        },
        objectives: [
          {
            id: "fetch_missing",
            type: "fetch_item",
            itemId: "missing_item",
            quantity: 0,
            description: "",
          },
          {
            id: "visit_missing",
            type: "visit_coordinate",
            zoneId: "missing_zone",
            x: -1,
            y: "bad",
            description: "Visit somewhere impossible",
          },
        ],
        rewards: {
          currency: -1,
          xp: -5,
          items: [{ itemId: "missing_reward", quantity: 0 }],
        },
      },
      createValidationContext(),
    );

    expect(diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          contentType: "quest",
          contentId: "broken_quest",
          path: "targetNpcId",
          message:
            'Quest "broken_quest" references unknown targetNpcId "missing_npc".',
        }),
        expect.objectContaining({
          path: "triggers.start.dialogueId",
          message:
            'Quest "broken_quest" start trigger references unknown dialogueId "missing.start".',
        }),
        expect.objectContaining({
          path: "npcOverrides.old_scholar.active",
          message:
            'Quest "broken_quest" npcOverrides for "old_scholar" active dialogue references unknown dialogueId "missing.active".',
        }),
        expect.objectContaining({
          path: "objectives[0].itemId",
          message:
            'Quest "broken_quest" objective "fetch_missing" references unknown itemId "missing_item".',
        }),
        expect.objectContaining({
          path: "objectives[1].zoneId",
          message:
            'Quest "broken_quest" objective "visit_missing" references unknown zoneId "missing_zone".',
        }),
        expect.objectContaining({
          path: "rewards.xp",
          message:
            'Quest "broken_quest" reward XP must be a non-negative integer.',
        }),
        expect.objectContaining({
          path: "rewards.items[0].quantity",
          message:
            'Quest "broken_quest" reward item 0 has invalid quantity. Must be a positive integer.',
        }),
      ]),
    );
  });

  it("uses the injected validation context instead of runtime registries", () => {
    const runtimeContext = createValidationContext();
    const itemIds = new Set(runtimeContext.itemIds);
    itemIds.delete("lost_notebook");

    const diagnostics = validateQuestDef(
      lostNotebookQuestData,
      createValidationContext({ itemIds }),
    );

    expect(diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: "objectives[0].itemId",
          message:
            'Quest "lost_notebook" objective "find_notebook" references unknown itemId "lost_notebook".',
        }),
      ]),
    );
  });

  it("reports registry-level duplicate quest ids and trigger collisions", () => {
    const diagnostics = validateQuestRegistry(
      [lostNotebookQuestData, lostNotebookQuestData],
      createValidationContext(),
    );

    expect(diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          contentType: "quest",
          contentId: "lost_notebook",
          path: "questId",
          message: 'Duplicate quest definition "lost_notebook".',
        }),
        expect.objectContaining({
          path: "triggers.start.dialogueId",
          message:
            'Quest "lost_notebook" triggers start from dialogueId "old_scholar.quest_start", which is already registered by another quest.',
        }),
        expect.objectContaining({
          path: "triggers.complete.dialogueId",
          message:
            'Quest "lost_notebook" triggers complete from dialogueId "old_scholar.quest_active_ready", which is already registered by another quest.',
        }),
      ]),
    );
  });
});

describe("Quest System", () => {
  afterEach(() => {
    clearQuestContentOverlay();
  });

  it("loads and validates the registries", () => {
    expect(hasQuestDef("lost_notebook")).toBe(true);
    const def = getQuestDef("lost_notebook");
    expect(def).toBeDefined();
    expect(def?.questId).toBe("lost_notebook");
    expect(def?.targetNpcId).toBe("old_scholar");
  });

  it("serves detached draft quest definitions from a dev content overlay", () => {
    const shipped = getQuestDef("lost_notebook")!;
    const draft: QuestDef = {
      ...(lostNotebookQuestData as QuestDef),
      name: "Draft Lost Notebook",
    };

    installQuestContentOverlay([draft], createValidationContext());

    expect(getAllQuestDefs()).toEqual([draft]);
    expect(hasQuestDef("lost_notebook")).toBe(true);
    expect(getQuestDef("lost_notebook")?.name).toBe("Draft Lost Notebook");

    const firstRead = getQuestDef("lost_notebook")!;
    firstRead.objectives[0].description = "Mutated";
    expect(getQuestDef("lost_notebook")).toEqual(draft);

    expect(getQuestDef("missing_overlay_quest")).toBeUndefined();

    clearQuestContentOverlay();
    expect(getQuestDef("lost_notebook")).toEqual(shipped);
  });

  it("advances quest states through NPC dialogue triggers", () => {
    const engine = createQuestEngine();

    // Player starts with quests empty
    let snapshot = engine.getSnapshot();
    expect(snapshot.activeQuests).toHaveLength(0);
    expect(snapshot.completedQuests).toHaveLength(0);

    // Speak to the scholar.
    const result = engine.execute({
      type: "Interact",
      targetNpcId: "old_scholar",
      targetDirection: "east",
    });
    expect(result.success).toBe(true);
    expect(result.dialogueId).toBe("old_scholar.quest_start");
    expect(result.dialogue?.[1]?.text).toContain(
      "Could you find it and bring it back to me?",
    );

    // Complete the dialogue to trigger the start of "lost_notebook"
    engine.execute({
      type: "CompleteDialogue",
    });

    snapshot = engine.getSnapshot();
    expect(snapshot.activeQuests).toHaveLength(1);
    expect(snapshot.activeQuests[0].questId).toBe("lost_notebook");
    expect(snapshot.activeQuests[0].state).toBe("active");
    expect(snapshot.activeQuests[0].objectives[0].currentQuantity).toBe(0);

    // The dialogue override for scholar should now be active_reminder
    const interact2 = engine.execute({
      type: "Interact",
      targetNpcId: "old_scholar",
      targetDirection: "east",
    });
    expect(interact2.dialogue?.[0]?.text).toContain(
      "Please find my lost notebook",
    );

    // Add lost_notebook to player's inventory
    const inventory = engine.getPlayerInventory();
    inventory.items.push({ itemId: "lost_notebook", quantity: 1 });

    // Objectives should be ready
    snapshot = engine.getSnapshot();
    expect(snapshot.activeQuests[0].state).toBe("readyToComplete");
    expect(snapshot.activeQuests[0].objectives[0].currentQuantity).toBe(1);

    // The dialogue override should now be activeReady
    const interact3 = engine.execute({
      type: "Interact",
      targetNpcId: "old_scholar",
      targetDirection: "east",
    });
    expect(interact3.dialogue?.[0]?.text).toContain(
      "Oh, you found my lost notebook!",
    );
    expect(interact3.dialogueId).toBe("old_scholar.quest_active_ready");

    // Complete the dialogue to trigger completion
    const completionResult = engine.execute({
      type: "CompleteDialogue",
    });

    // Let's verify item was consumed, rewards granted, and quest marked completed.
    snapshot = engine.getSnapshot();
    expect(snapshot.activeQuests).toHaveLength(0);
    expect(snapshot.completedQuests).toContain("lost_notebook");

    // Scholar dialogue should now be completed override
    const interact4 = engine.execute({
      type: "Interact",
      targetNpcId: "old_scholar",
      targetDirection: "east",
    });
    expect(interact4.dialogue?.[0]?.text).toContain(
      "Thank you again for returning",
    );

    // Currency should have increased by 150
    expect(snapshot.stats.currency).toBe(1700); // 1550 (start) + 150 (reward)

    // Inventory should have 2 travel rations (since they are awarded as reward)
    const rations = snapshot.inventory.items.find(
      (item) => item.itemId === "travel_ration",
    );
    expect(rations?.quantity).toBe(5); // 3 (start) + 2 (reward)
    expect(completionResult.effects).toEqual([
      {
        type: "ItemLost",
        itemId: "lost_notebook",
        quantity: 1,
        source: "quest_turn_in",
      },
      {
        type: "ItemCollected",
        itemId: "travel_ration",
        quantity: 2,
        source: "reward",
      },
    ]);
    expect(snapshot.log.map((entry) => entry.message)).toContain(
      "Quest Rewards: 1s 50c, Travel Ration x2.",
    );
  });

  it("preserves quests state across saving and loading", () => {
    const engine = createQuestEngine();

    // Start quest
    engine.execute({
      type: "Interact",
      targetNpcId: "old_scholar",
      targetDirection: "east",
    });
    engine.execute({
      type: "CompleteDialogue",
    });

    // Save state
    const saveData = engine.createSaveData();
    expect(saveData.activeQuests).toContain("lost_notebook");

    // Load state
    const engine2 = GameplayEngine.fromSaveData(saveData, {
      resolveZone: () => loadZone(zoneData),
    });
    const snapshot2 = engine2.getSnapshot();
    expect(snapshot2.activeQuests).toHaveLength(1);
    expect(snapshot2.activeQuests[0].questId).toBe("lost_notebook");
  });

  it("does not trigger quest transitions without a pending NPC dialogue", () => {
    const engine = createQuestEngine();

    const result = engine.execute({ type: "CompleteDialogue" });

    expect(result.success).toBe(false);
    expect(engine.getSnapshot().activeQuests).toHaveLength(0);
    expect(engine.getSnapshot().completedQuests).toHaveLength(0);
  });

  it("tracks coordinate and stat threshold objectives dynamically and stickily", () => {
    const advancedZoneData = {
      ...zoneData,
      npcs: [
        {
          npcId: "old_scholar",
          x: 2,
          y: 1,
          dialogueId: "old_scholar.advanced_quest_start",
        },
      ],
    };
    const engine = new GameplayEngine(loadZone(advancedZoneData));
 
    // Start advanced_quest
    engine.execute({
      type: "Interact",
      targetNpcId: "old_scholar",
      targetDirection: "east",
    });
    engine.execute({ type: "CompleteDialogue" });
 
    let snapshot = engine.getSnapshot();
    const activeQuest = snapshot.activeQuests.find((q) => q.questId === "advanced_quest")!;
    expect(activeQuest).toBeDefined();
    expect(activeQuest.state).toBe("active");
 
    // Objectives check
    let visitObj = activeQuest.objectives.find((obj) => obj.id === "visit_ruins")!;
    let statObj = activeQuest.objectives.find((obj) => obj.id === "study_scribing")!;
    expect(visitObj.currentQuantity).toBe(0);
    expect(statObj.currentQuantity).toBe(10);
    expect(engine.isQuestReadyToComplete("advanced_quest")).toBe(false);
 
    // 1. Move player to (2, 2) to trigger coordinate objective
    // Path: Move South to (1, 2), then East to (2, 2)
    engine.execute({ type: "MoveSouth" });
    engine.execute({ type: "MoveEast" });
 
    snapshot = engine.getSnapshot();
    let activeQuestUpdated = snapshot.activeQuests.find((q) => q.questId === "advanced_quest")!;
    visitObj = activeQuestUpdated.objectives.find((obj) => obj.id === "visit_ruins")!;
    expect(visitObj.currentQuantity).toBe(1); // Reached ruins!
    expect(engine.createSaveData().completedObjectives).toEqual([
      "advanced_quest:visit_ruins",
    ]);
    expect(engine.isQuestReadyToComplete("advanced_quest")).toBe(false);
 
    // Step away and confirm it remains completed (sticky state)
    engine.execute({ type: "MoveWest" });
    snapshot = engine.getSnapshot();
    activeQuestUpdated = snapshot.activeQuests.find((q) => q.questId === "advanced_quest")!;
    visitObj = activeQuestUpdated.objectives.find((obj) => obj.id === "visit_ruins")!;
    expect(visitObj.currentQuantity).toBe(1);
 
    // 2. Increase intelligence to 12 using save-load injection
    const saveData = engine.createSaveData();
    saveData.stats.attributes.intelligence = 12;
    
    let engine2 = GameplayEngine.fromSaveData(saveData, {
      resolveZone: () => loadZone(advancedZoneData),
    });
 
    snapshot = engine2.getSnapshot();
    activeQuestUpdated = snapshot.activeQuests.find((q) => q.questId === "advanced_quest")!;
    statObj = activeQuestUpdated.objectives.find((obj) => obj.id === "study_scribing")!;
    expect(statObj.currentQuantity).toBe(12);
    expect(activeQuestUpdated.state).toBe("readyToComplete");
    expect(engine2.isQuestReadyToComplete("advanced_quest")).toBe(true);
 
    // Revert intelligence to 11 and confirm it becomes incomplete again (dynamic state)
    const saveData2 = engine2.createSaveData();
    saveData2.stats.attributes.intelligence = 11;
    let engine3 = GameplayEngine.fromSaveData(saveData2, {
      resolveZone: () => loadZone(advancedZoneData),
    });
 
    snapshot = engine3.getSnapshot();
    activeQuestUpdated = snapshot.activeQuests.find((q) => q.questId === "advanced_quest")!;
    expect(activeQuestUpdated.state).toBe("active");
    expect(engine3.isQuestReadyToComplete("advanced_quest")).toBe(false);
 
    // Return stats back to 12
    const saveData3 = engine3.createSaveData();
    saveData3.stats.attributes.intelligence = 12;
    let engine4 = GameplayEngine.fromSaveData(saveData3, {
      resolveZone: () => loadZone(advancedZoneData),
    });
 
    // Move back to (1, 1) and talk to the scholar
    engine4.execute({ type: "MoveNorth" });
    const completionResult = engine4.execute({
      type: "Interact",
      targetNpcId: "old_scholar",
      targetDirection: "east",
    });
    expect(completionResult.dialogueId).toBe("old_scholar.advanced_quest_complete");
 
    // Hand in
    engine4.execute({ type: "CompleteDialogue" });
    snapshot = engine4.getSnapshot();
    expect(snapshot.activeQuests.find((q) => q.questId === "advanced_quest")).toBeUndefined();
    expect(snapshot.completedQuests).toContain("advanced_quest");
    expect(engine4.createSaveData().completedObjectives).toEqual([]);
  });

  it("migrates legacy unqualified completed objective ids on load", () => {
    const advancedZoneData = {
      ...zoneData,
      npcs: [
        {
          npcId: "old_scholar",
          x: 2,
          y: 1,
          dialogueId: "old_scholar.advanced_quest_start",
        },
      ],
    };
    const engine = new GameplayEngine(loadZone(advancedZoneData));

    engine.execute({
      type: "Interact",
      targetNpcId: "old_scholar",
      targetDirection: "east",
    });
    engine.execute({ type: "CompleteDialogue" });

    const saveData = engine.createSaveData();
    saveData.completedObjectives = ["visit_ruins"];

    const restored = GameplayEngine.fromSaveData(saveData, {
      resolveZone: () => loadZone(advancedZoneData),
    });
    const activeQuest = restored
      .getSnapshot()
      .activeQuests.find((quest) => quest.questId === "advanced_quest")!;
    const visitObjective = activeQuest.objectives.find(
      (objective) => objective.id === "visit_ruins",
    )!;

    expect(visitObjective.currentQuantity).toBe(1);
    expect(restored.createSaveData().completedObjectives).toEqual([
      "advanced_quest:visit_ruins",
    ]);
  });

  it("tracks defeat_npc objectives when a quest target is defeated", () => {
    const engine = new GameplayEngine(loadZone(combatQuestZoneData), {
      random: () => 0.5,
    });
    const saveData = engine.createSaveData();
    saveData.activeQuests = ["slay_the_slime"];

    const restored = GameplayEngine.fromSaveData(saveData, {
      random: () => 0.5,
      resolveZone: () => loadZone(combatQuestZoneData),
    });

    restored.execute({ type: "MoveEast" });
    restored.execute({ type: "SelectCombatAction", actionKind: "strike" });
    restored.execute({
      type: "SubmitCombatQte",
      completed: true,
      inputAdvantage: 6,
      mistakes: 0,
    });
    restored.execute({ type: "StartOpponentTurn" });
    restored.execute({
      type: "SubmitCombatQte",
      completed: true,
      inputAdvantage: 5,
      mistakes: 0,
    });
    restored.execute({ type: "SelectCombatAction", actionKind: "strike" });
    restored.execute({
      type: "SubmitCombatQte",
      completed: true,
      inputAdvantage: 6,
      mistakes: 0,
    });

    const snapshot = restored.getSnapshot();
    const activeQuest = snapshot.activeQuests.find(
      (quest) => quest.questId === "slay_the_slime",
    )!;
    const objective = activeQuest.objectives.find(
      (obj) => obj.id === "defeat_slime",
    )!;

    expect(snapshot.combatState?.phase).toBe("victory");
    expect(activeQuest.state).toBe("readyToComplete");
    expect(objective).toMatchObject({
      type: "defeat_npc",
      npcId: "slime",
      currentQuantity: 1,
      requiredQuantity: 1,
    });
    expect(restored.createSaveData().completedObjectives).toEqual([
      "slay_the_slime:defeat_slime",
    ]);
    expect(snapshot.inventory.items.some((item) => item.itemId === "slime_remains")).toBe(false);
    expect(snapshot.log.map((entry) => entry.message)).toContain(
      "Completed objective: Defeat the slime",
    );
  });

  it("loads defeat_the_kobold quest successfully", () => {
    expect(hasQuestDef("defeat_the_kobold")).toBe(true);
    const def = getQuestDef("defeat_the_kobold");
    expect(def).toBeDefined();
    expect(def?.questId).toBe("defeat_the_kobold");
    expect(def?.targetNpcId).toBe("old_wizard");
    const objective = def?.objectives[0];
    expect(objective).toBeDefined();
    if (objective?.type === "defeat_npc") {
      expect(objective.npcId).toBe("kobold");
      expect(objective.quantity).toBe(1);
    } else {
      throw new Error("Objective is not a defeat_npc type");
    }
  });
});
