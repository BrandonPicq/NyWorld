import { describe, expect, it } from "vitest";
import { GameplayEngine } from "../GameplayEngine";
import { loadZone } from "../zoneLoader";
import type { ZoneData } from "../ZoneTypes";

const movementZoneData: ZoneData = {
  version: "0.1",
  zoneId: "movement_test",
  name: "Movement Test",
  width: 10,
  height: 8,
  playerStart: { x: 5, y: 4 },
  tiles: [
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    [1, 0, 0, 0, 0, 0, 0, 0, 0, 1],
    [1, 0, 0, 0, 0, 0, 0, 0, 0, 1],
    [1, 0, 0, 0, 0, 0, 0, 0, 0, 1],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [1, 0, 0, 0, 0, 0, 0, 0, 0, 1],
    [1, 0, 0, 0, 0, 0, 0, 0, 0, 1],
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  ],
  entryDialogue: [
    { speaker: "Narrator", text: "Test entry.", pitch: 1 },
  ],
  transitions: [
    { x: 9, y: 4, targetZoneId: "second_zone", targetX: 1, targetY: 4 },
  ],
  npcs: [
    {
      npcId: "slime",
      x: 6,
      y: 4,
    },
  ],
  items: [],
};

const secondZoneData: ZoneData = {
  version: "0.1",
  zoneId: "second_zone",
  name: "Second Zone",
  width: 10,
  height: 8,
  playerStart: { x: 1, y: 4 },
  tiles: [
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    [1, 0, 0, 0, 0, 0, 0, 0, 0, 1],
    [1, 0, 0, 0, 0, 0, 0, 0, 0, 1],
    [1, 0, 0, 0, 0, 0, 0, 0, 0, 1],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
    [1, 0, 0, 0, 0, 0, 0, 0, 0, 1],
    [1, 0, 0, 0, 0, 0, 0, 0, 0, 1],
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  ],
  entryDialogue: [
    { speaker: "Narrator", text: "Test entry second.", pitch: 1 },
  ],
  transitions: [
    { x: 0, y: 4, targetZoneId: "movement_test", targetX: 8, targetY: 4 },
  ],
  npcs: [
    {
      npcId: "slime",
      x: 2,
      y: 4,
    },
  ],
  items: [],
};

function createEngine() {
  const zoneRegistry: Record<string, ZoneData> = {
    test_zone: movementZoneData,
    movement_test: movementZoneData,
    second_zone: secondZoneData,
  };
  return new GameplayEngine(loadZone(movementZoneData), {
    resolveZone: (zoneId) => {
      const data = zoneRegistry[zoneId];
      return data ? loadZone(data) : undefined;
    },
  });
}

describe("Combat Engine Integration", () => {
  it("starts combat when player runs into slime NPC", () => {
    const engine = createEngine();
    const result = engine.execute({ type: "MoveEast" });

    expect(result.success).toBe(true);
    const snapshot = engine.getSnapshot();
    expect(snapshot.combatState).toBeDefined();
    expect(snapshot.combatState!.opponentNpcId).toBe("slime");
    expect(snapshot.combatState!.phase).toBe("action_selection");
    expect(snapshot.log.map((l) => l.message)).toContain("Combat started with Slime!");
  });

  it("handles combat action selection (physical/magical) and QTE setup", () => {
    const engine = createEngine();
    engine.execute({ type: "MoveEast" }); // Start combat

    const result = engine.execute({ type: "SelectCombatAction", actionKind: "physical" });
    expect(result.success).toBe(true);

    const snapshot = engine.getSnapshot();
    expect(snapshot.combatState!.phase).toBe("player_qte");
    expect(snapshot.combatState!.actionKind).toBe("physical");
    expect(snapshot.combatState!.qteChallenge).toBeDefined();
    expect(snapshot.combatState!.qteSequence).toHaveLength(snapshot.combatState!.qteChallenge!.sequenceLength);
  });

  it("resolves player QTE attack and advances to enemy turn if opponent survives", () => {
    const engine = createEngine();
    engine.execute({ type: "MoveEast" }); // Start combat
    engine.execute({ type: "SelectCombatAction", actionKind: "physical" }); // Select attack

    // Player hits with advantage 2 (dealing normal damage)
    const result = engine.execute({ type: "SubmitCombatQte", completed: true, inputAdvantage: 2 });
    expect(result.success).toBe(true);

    const snapshot = engine.getSnapshot();
    // Opponent had 20 HP, attack was 10 (from player stats), slime def is 1
    // effectiveDefense = 1 - Math.floor(2/2) = 0.
    // baseDamage = 10 - 0 = 10.
    // Slime HP becomes 20 - 10 = 10.
    expect(snapshot.combatState!.opponentStats.resources.hp).toBe(10);
    // Opponent survived, phase should now be enemy QTE
    expect(snapshot.combatState!.phase).toBe("enemy_qte");
  });

  it("handles player QTE defense against enemy attack and transitions back to action selection", () => {
    const engine = createEngine();
    engine.execute({ type: "MoveEast" }); // Start combat
    engine.execute({ type: "SelectCombatAction", actionKind: "physical" });
    engine.execute({ type: "SubmitCombatQte", completed: true, inputAdvantage: 2 }); // Player attack resolved

    // Player defends successfully with inputAdvantage 5 (evaded, 0 damage)
    const result = engine.execute({ type: "SubmitCombatQte", completed: true, inputAdvantage: 5 });
    expect(result.success).toBe(true);

    const snapshot = engine.getSnapshot();
    expect(snapshot.combatState!.phase).toBe("action_selection");
    // Player remains at full HP (100)
    expect(snapshot.stats.resources.hp).toBe(100);
  });

  it("allows player to successfully conclude combat on victory and collect loot", () => {
    const engine = createEngine();
    engine.execute({ type: "MoveEast" }); // Start combat
    engine.execute({ type: "SelectCombatAction", actionKind: "physical" });

    // Force a one-shot hit. Player attack is 10. Slime HP is 20.
    // Let's do a critical hit with inputAdvantage 6.
    // defenseReduction = 3. Slime defense is 1 -> effectiveDefense = 0.
    // baseDamage = 10.
    // critical bonus = Math.floor(10 * 0.5) = 5.
    // damage = Math.max(2, 10 + Math.max(1, 5)) = 15.
    // This is not enough to kill, but we can do it twice.
    engine.execute({ type: "SubmitCombatQte", completed: true, inputAdvantage: 6 }); // First hit (slime HP = 5)
    
    // Opponent attacks, player blocks
    engine.execute({ type: "SubmitCombatQte", completed: true, inputAdvantage: 5 });

    // Second hit
    engine.execute({ type: "SelectCombatAction", actionKind: "physical" });
    engine.execute({ type: "SubmitCombatQte", completed: true, inputAdvantage: 6 }); // Second hit (slime HP = 0)

    const snapBeforeConclude = engine.getSnapshot();
    expect(snapBeforeConclude.combatState!.phase).toBe("victory");

    // Conclude combat
    const concludeResult = engine.execute({ type: "ConcludeCombat" });
    expect(concludeResult.success).toBe(true);

    const finalSnap = engine.getSnapshot();
    expect(finalSnap.combatState).toBeUndefined();
    // Inventory should have slime remains
    const remains = finalSnap.inventory.items.find((i) => i.itemId === "slime_remains");
    expect(remains).toBeDefined();
    expect(remains!.quantity).toBe(1);
    // Slime NPC should be destroyed/removed
    expect(finalSnap.entities.find((e) => e.glyph === "s")).toBeUndefined();
  });

  it("teleports player back to safety and restores 50% stats on defeat", () => {
    // Initialize engine on second_zone
    const zoneRegistry: Record<string, ZoneData> = {
      test_zone: movementZoneData,
      movement_test: movementZoneData,
      second_zone: secondZoneData,
    };
    let engine = new GameplayEngine(loadZone(secondZoneData), {
      resolveZone: (zoneId) => {
        const data = zoneRegistry[zoneId];
        return data ? loadZone(data) : undefined;
      },
    });

    // Verify player starts on second_zone
    expect(engine.getSnapshot().zoneId).toBe("second_zone");

    // Create a save payload, set player HP to 1, and restore the engine
    const save = engine.createSaveData();
    save.stats.resources.hp = 1;

    engine = GameplayEngine.fromSaveData(save, {
      resolveZone: (zoneId) => {
        const data = zoneRegistry[zoneId];
        return data ? loadZone(data) : undefined;
      },
    });

    // Player now has 1 HP on second_zone
    expect(engine.getSnapshot().stats.resources.hp).toBe(1);

    // Move East once to collide with slime on second_zone and start combat
    engine.execute({ type: "MoveEast" });
    
    expect(engine.getSnapshot().combatState).toBeDefined();
    expect(engine.getSnapshot().combatState!.phase).toBe("action_selection");

    // Start action
    engine.execute({ type: "SelectCombatAction", actionKind: "physical" });
    // Player hits slime
    engine.execute({ type: "SubmitCombatQte", completed: true, inputAdvantage: 1 });

    // Enemy attacks, player fails defense
    engine.execute({ type: "SubmitCombatQte", completed: false, inputAdvantage: -6 });

    const snapDefeat = engine.getSnapshot();
    expect(snapDefeat.combatState!.phase).toBe("defeat");
    expect(snapDefeat.stats.resources.hp).toBe(0);

    // Conclude combat
    engine.execute({ type: "ConcludeCombat" });

    const snapAfterDefeat = engine.getSnapshot();
    expect(snapAfterDefeat.combatState).toBeUndefined();
    // Teleported to safety on test_zone at (5, 4)
    expect(snapAfterDefeat.zoneId).toBe("movement_test");
    expect(snapAfterDefeat.playerX).toBe(5);
    expect(snapAfterDefeat.playerY).toBe(4);
    // HP and Energy restored to 50%
    expect(snapAfterDefeat.stats.resources.hp).toBe(50);
    expect(snapAfterDefeat.stats.resources.energy).toBe(50);
  });
});
