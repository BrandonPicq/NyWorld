import { describe, expect, it } from "vitest";
import { GameplayEngine } from "../GameplayEngine";
import { loadZone } from "../zoneLoader";
import { getQuestDef, hasQuestDef } from "./questRegistry";
import type { Inventory } from "../components";

const zoneData = {
  version: "0.1",
  zoneId: "quest_test_zone",
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
    engine.execute({
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
});
