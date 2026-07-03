import { describe, expect, it } from "vitest";
import { GameplayEngine } from "../GameplayEngine";
import { loadZone } from "../zoneLoader";
import { getQuestDef, hasQuestDef } from "./questRegistry";
import type { Inventory } from "../components";

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

function createQuestEngine() {
  return new GameplayEngine(loadZone(zoneData));
}

describe("Quest System", () => {
  it("loads and validates the registries", () => {
    expect(hasQuestDef("lost_notebook")).toBe(true);
    const def = getQuestDef("lost_notebook");
    expect(def).toBeDefined();
    expect(def?.questId).toBe("lost_notebook");
    expect(def?.targetNpcId).toBe("old_scholar");
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
      "Quest Rewards: 1s 50b, Travel Ration x2.",
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
});
