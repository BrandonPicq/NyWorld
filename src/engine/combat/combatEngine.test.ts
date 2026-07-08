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
    random: () => 0.5,
    resolveZone: (zoneId) => {
      const data = zoneRegistry[zoneId];
      return data ? loadZone(data) : undefined;
    },
  });
}

function startSlimeCombat(engine: GameplayEngine) {
  engine.execute({ type: "MoveEast" });
  engine.execute({ type: "SelectCombatAction", actionKind: "strike" });
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

  it("handles combat action selection and QTE setup", () => {
    const engine = createEngine();
    engine.execute({ type: "MoveEast" }); // Start combat

    const result = engine.execute({ type: "SelectCombatAction", actionKind: "strike" });
    expect(result.success).toBe(true);

    const snapshot = engine.getSnapshot();
    expect(snapshot.combatState!.phase).toBe("player_qte");
    expect(snapshot.combatState!.actionKind).toBe("physical");
    expect(snapshot.combatState!.actionLabel).toBe("Strike");
    expect(snapshot.combatState!.qteChallenge).toBeDefined();
    expect(snapshot.combatState!.qteSequence).toHaveLength(snapshot.combatState!.qteChallenge!.sequenceLength);
  });

  it("selects a learned magical pattern, consumes MP, and resolves multiplied damage", () => {
    const save = createEngine().createSaveData();
    save.knownPatterns = { fireball: { timesUsed: 0 } };
    save.stats.resources.mp = 50;

    const engine = GameplayEngine.fromSaveData(save, {
      random: () => 0.5,
      resolveZone: (zoneId) =>
        zoneId === "movement_test" ? loadZone(movementZoneData) : undefined,
    });
    engine.execute({ type: "MoveEast" });

    const select = engine.execute({
      type: "SelectCombatPattern",
      actionKind: "cast",
      patternId: "fireball",
    });

    expect(select.success).toBe(true);
    let snapshot = engine.getSnapshot();
    expect(snapshot.stats.resources.mp).toBe(36);
    expect(snapshot.combatState!.phase).toBe("player_qte");
    expect(snapshot.combatState!.actionKind).toBe("magical");
    expect(snapshot.combatState!.actionLabel).toBe("Fireball");
    expect(snapshot.combatState!.minigame).toMatchObject({
      kind: "sequence",
      hidden: true,
      sequence: ["up", "left", "down", "right", "up"],
    });

    engine.execute({
      type: "SubmitCombatQte",
      completed: true,
      inputAdvantage: 2,
      mistakes: 0,
    });

    snapshot = engine.getSnapshot();
    expect(snapshot.combatState!.opponentStats.resources.hp).toBe(4);
    expect(snapshot.combatState!.activePatternId).toBeUndefined();
    expect(snapshot.knownPatterns.fireball.timesUsed).toBe(1);
    expect(snapshot.log.map((entry) => entry.message)).toContain(
      "You prepare Fireball and spend 14 MP.",
    );
  });

  it("evolves a pattern after use and preserves it through a save round-trip", () => {
    const save = createEngine().createSaveData();
    save.knownPatterns = { fireball: { timesUsed: 14 } };
    save.playerProgression.global.level = 5;
    save.stats.resources.mp = 50;

    const engine = GameplayEngine.fromSaveData(save, {
      random: () => 0.5,
      resolveZone: (zoneId) =>
        zoneId === "movement_test" ? loadZone(movementZoneData) : undefined,
    });
    engine.execute({ type: "MoveEast" });
    engine.execute({
      type: "SelectCombatPattern",
      actionKind: "cast",
      patternId: "fireball",
    });
    engine.execute({
      type: "SubmitCombatQte",
      completed: true,
      inputAdvantage: 2,
      mistakes: 0,
    });

    let snapshot = engine.getSnapshot();
    expect(snapshot.knownPatterns).toEqual({
      fireball: { timesUsed: 15 },
      pyrosphere: { timesUsed: 0 },
    });
    expect(snapshot.log.map((entry) => entry.message)).toContain(
      "Your Fireball technique evolved into Pyrosphere.",
    );
    expect(engine.consumeNotices()).toContainEqual({
      title: "Technique Evolved",
      message: "Your Fireball technique evolved into Pyrosphere.",
    });

    const restored = GameplayEngine.fromSaveData(engine.createSaveData(), {
      random: () => 0.5,
      resolveZone: (zoneId) =>
        zoneId === "movement_test" ? loadZone(movementZoneData) : undefined,
    });
    snapshot = restored.getSnapshot();
    expect(snapshot.knownPatterns).toEqual({
      fireball: { timesUsed: 15 },
      pyrosphere: { timesUsed: 0 },
    });
  });

  it("rejects physical patterns when the required weapon is not equipped", () => {
    const save = createEngine().createSaveData();
    save.knownPatterns = { crosscut: { timesUsed: 0 } };
    save.stats.resources.mp = 50;

    const engine = GameplayEngine.fromSaveData(save, {
      random: () => 0.5,
      resolveZone: (zoneId) =>
        zoneId === "movement_test" ? loadZone(movementZoneData) : undefined,
    });
    engine.execute({ type: "MoveEast" });

    const result = engine.execute({
      type: "SelectCombatPattern",
      actionKind: "strike",
      patternId: "crosscut",
    });

    expect(result.success).toBe(false);
    expect(engine.getSnapshot().combatState!.phase).toBe("action_selection");
    expect(engine.getSnapshot().knownPatterns.crosscut.timesUsed).toBe(0);
    expect(engine.getSnapshot().log.map((entry) => entry.message)).toContain(
      "Crosscut cannot be used right now.",
    );
  });

  it("resolves player QTE attack and advances to enemy turn if opponent survives", () => {
    const engine = createEngine();
    startSlimeCombat(engine);

    // Player hits with advantage 2 (dealing normal damage) and 0 mistakes
    const result = engine.execute({ type: "SubmitCombatQte", completed: true, inputAdvantage: 2, mistakes: 0 });
    expect(result.success).toBe(true);

    let snapshot = engine.getSnapshot();
    // Opponent had 20 HP, attack was 10 (from player stats), slime def is 1
    // effectiveDefense = 1 - Math.floor(2/2) = 0.
    // baseDamage = 10 - 0 = 10.
    // Slime HP becomes 20 - 10 = 10.
    expect(snapshot.combatState!.opponentStats.resources.hp).toBe(10);
    // Opponent survived, phase should now be opponent_turn_transition
    expect(snapshot.combatState!.phase).toBe("opponent_turn_transition");

    // Advance to enemy turn
    engine.execute({ type: "StartOpponentTurn" });
    snapshot = engine.getSnapshot();
    expect(snapshot.combatState!.phase).toBe("enemy_qte");
  });

  it("varies final player attack damage between 75 and 125 percent", () => {
    const lowRollEngine = new GameplayEngine(loadZone(movementZoneData), {
      random: () => 0,
    });
    startSlimeCombat(lowRollEngine);
    lowRollEngine.execute({
      type: "SubmitCombatQte",
      completed: true,
      inputAdvantage: 2,
      mistakes: 0,
    });

    const highRollEngine = new GameplayEngine(loadZone(movementZoneData), {
      random: () => 1,
    });
    startSlimeCombat(highRollEngine);
    highRollEngine.execute({
      type: "SubmitCombatQte",
      completed: true,
      inputAdvantage: 2,
      mistakes: 0,
    });

    expect(lowRollEngine.getSnapshot().combatState!.opponentStats.resources.hp).toBe(12);
    expect(highRollEngine.getSnapshot().combatState!.opponentStats.resources.hp).toBe(8);
  });

  it("handles player QTE defense against enemy attack and transitions back to action selection", () => {
    const engine = createEngine();
    engine.execute({ type: "MoveEast" }); // Start combat
    engine.execute({ type: "SelectCombatAction", actionKind: "strike" });
    engine.execute({ type: "SubmitCombatQte", completed: true, inputAdvantage: 2, mistakes: 0 }); // Player attack resolved
    engine.execute({ type: "StartOpponentTurn" }); // Go to enemy QTE

    // Player defends successfully with inputAdvantage 5 (evaded, 0 damage) and 0 mistakes
    const result = engine.execute({ type: "SubmitCombatQte", completed: true, inputAdvantage: 5, mistakes: 0 });
    expect(result.success).toBe(true);

    const snapshot = engine.getSnapshot();
    expect(snapshot.combatState!.phase).toBe("action_selection");
    // Player remains at full HP (100)
    expect(snapshot.stats.resources.hp).toBe(100);
  });

  it("allows player to successfully conclude combat on victory and collect loot", () => {
    const engine = createEngine();
    engine.execute({ type: "MoveEast" }); // Start combat
    engine.execute({ type: "SelectCombatAction", actionKind: "strike" });

    // Force a one-shot hit. Player attack is 10. Slime HP is 20.
    // Let's do a critical hit with inputAdvantage 6.
    // defenseReduction = 3. Slime defense is 1 -> effectiveDefense = 0.
    // baseDamage = 10.
    // critical bonus = Math.floor(10 * 0.5) = 5.
    // damage = Math.max(2, 10 + Math.max(1, 5)) = 15.
    // This is not enough to kill, but we can do it twice.
    engine.execute({ type: "SubmitCombatQte", completed: true, inputAdvantage: 6, mistakes: 0 }); // First hit (slime HP = 5)
    engine.execute({ type: "StartOpponentTurn" });
    
    // Opponent attacks, player blocks
    engine.execute({ type: "SubmitCombatQte", completed: true, inputAdvantage: 5, mistakes: 0 });

    // Second hit
    engine.execute({ type: "SelectCombatAction", actionKind: "strike" });
    engine.execute({ type: "SubmitCombatQte", completed: true, inputAdvantage: 6, mistakes: 0 }); // Second hit (slime HP = 0)

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
    const safeRespawn = { zoneId: "movement_test", x: 4, y: 4 };
    let engine = new GameplayEngine(loadZone(secondZoneData), {
      random: () => 0.5,
      safeRespawn,
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
      random: () => 0.5,
      safeRespawn,
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
    engine.execute({ type: "SelectCombatAction", actionKind: "strike" });
    // Player hits slime
    engine.execute({ type: "SubmitCombatQte", completed: true, inputAdvantage: 1, mistakes: 0 });
    engine.execute({ type: "StartOpponentTurn" });

    // Enemy attacks, player fails defense
    engine.execute({ type: "SubmitCombatQte", completed: false, inputAdvantage: -6, mistakes: 0 });

    const snapDefeat = engine.getSnapshot();
    expect(snapDefeat.combatState!.phase).toBe("defeat");
    expect(snapDefeat.stats.resources.hp).toBe(0);

    // Conclude combat
    engine.execute({ type: "ConcludeCombat" });

    const snapAfterDefeat = engine.getSnapshot();
    expect(snapAfterDefeat.combatState).toBeUndefined();
    // Teleported to the configured safe respawn point.
    expect(snapAfterDefeat.zoneId).toBe("movement_test");
    expect(snapAfterDefeat.playerX).toBe(4);
    expect(snapAfterDefeat.playerY).toBe(4);
    // HP and Energy restored to 50%
    expect(snapAfterDefeat.stats.resources.hp).toBe(50);
    expect(snapAfterDefeat.stats.resources.energy).toBe(50);
  });

  it("applies 20% attack damage reduction on 1 mistake", () => {
    const engine = createEngine();
    startSlimeCombat(engine);

    // Player hits with advantage 2 and 1 mistake
    engine.execute({ type: "SubmitCombatQte", completed: true, inputAdvantage: 2, mistakes: 1 });

    const snapshot = engine.getSnapshot();
    // Base damage is 10 (player ATK 10 - slime DEF 0).
    // Reduced by 20% -> 10 * 0.8 = 8 damage.
    // Slime HP becomes 20 - 8 = 12.
    expect(snapshot.combatState!.opponentStats.resources.hp).toBe(12);
  });

  it("deals 0 damage and misses attack on 2 mistakes", () => {
    const engine = createEngine();
    startSlimeCombat(engine);

    // Player fails with 2 mistakes
    engine.execute({ type: "SubmitCombatQte", completed: false, inputAdvantage: -3, mistakes: 2 });

    const snapshot = engine.getSnapshot();
    // Slime HP remains 20 (0 damage)
    expect(snapshot.combatState!.opponentStats.resources.hp).toBe(20);
  });

  it("applies 20% increased defense damage taken on 1 mistake during block", () => {
    const engine = createEngine();
    engine.execute({ type: "MoveEast" }); // Start combat
    engine.execute({ type: "SelectCombatAction", actionKind: "strike" });
    engine.execute({ type: "SubmitCombatQte", completed: true, inputAdvantage: 2, mistakes: 0 }); // Player attack resolved
    engine.execute({ type: "StartOpponentTurn" }); // Go to enemy QTE

    // Player blocks with 1 mistake.
    // Slime attack is 3. Player def is 10.
    // resolveQteContest yields: baseDamage = Math.max(1, 3 - 10) = 1.
    // 20% penalty -> 1 * 1.2 = 1.2 -> Math.floor(1.2) = 1 damage.
    // Let's verify player HP. Since player HP is 100, 100 - 1 = 99 HP.
    engine.execute({ type: "SubmitCombatQte", completed: true, inputAdvantage: 1, mistakes: 1 });

    const snapshot = engine.getSnapshot();
    expect(snapshot.stats.resources.hp).toBe(99);
  });

  it("forces critical hit plus 20% damage on 2 mistakes during defense", () => {
    const engine = createEngine();
    engine.execute({ type: "MoveEast" }); // Start combat
    engine.execute({ type: "SelectCombatAction", actionKind: "strike" });
    engine.execute({ type: "SubmitCombatQte", completed: true, inputAdvantage: 2, mistakes: 0 }); // Player attack resolved
    engine.execute({ type: "StartOpponentTurn" }); // Go to enemy QTE

    // Player fails defense with 2 mistakes.
    // Slime attack is 3. Player defense is 10.
    // Critical contest forces inputAdvantage: 5 (attackerCompleted: true).
    // defenseReduction = Math.floor(5/2) = 2.
    // effectiveDefense = Math.max(0, 10 - 2) = 8.
    // baseDamage = Math.max(1, 3 - 8) = 1.
    // critical bonus = Math.floor(3 * 0.5) = 1.
    // criticalDamage = Math.max(2, baseDamage + Math.max(1, critical bonus)) = Math.max(2, 1 + 1) = 2.
    // finalDamage = Math.floor(criticalDamage * 1.2) = Math.floor(2 * 1.2) = 2.
    // Player HP becomes 100 - 2 = 98.
    engine.execute({ type: "SubmitCombatQte", completed: false, inputAdvantage: -1, mistakes: 2 });

    const snapshot = engine.getSnapshot();
    expect(snapshot.stats.resources.hp).toBe(98);
  });

  it("rejects casting when the player does not have enough MP", () => {
    const save = createEngine().createSaveData();
    save.stats.resources.mp = 0;
    const engine = GameplayEngine.fromSaveData(save, {
      random: () => 0.5,
      resolveZone: () => loadZone(movementZoneData),
    });

    engine.execute({ type: "MoveEast" });
    const result = engine.execute({
      type: "SelectCombatAction",
      actionKind: "cast",
    });

    const snapshot = engine.getSnapshot();
    expect(result.success).toBe(false);
    expect(snapshot.stats.resources.mp).toBe(0);
    expect(snapshot.combatState!.phase).toBe("action_selection");
    expect(snapshot.log.map((entry) => entry.message)).toContain(
      "Not enough MP to cast.",
    );
  });

  it("spends MP when casting successfully", () => {
    const engine = createEngine();
    engine.execute({ type: "MoveEast" });

    const result = engine.execute({
      type: "SelectCombatAction",
      actionKind: "cast",
    });

    const snapshot = engine.getSnapshot();
    expect(result.success).toBe(true);
    expect(snapshot.stats.resources.mp).toBe(60);
    expect(snapshot.combatState!.phase).toBe("player_qte");
    expect(snapshot.combatState!.actionKind).toBe("magical");
    expect(snapshot.combatState!.actionLabel).toBe("Cast");
  });

  it("lets Strike, Guard, and Focus gain SP", () => {
    const strikeEngine = createEngine();
    strikeEngine.execute({ type: "MoveEast" });
    strikeEngine.execute({ type: "SelectCombatAction", actionKind: "strike" });
    expect(strikeEngine.getSnapshot().stats.resources.sp).toBe(5);

    const guardEngine = createEngine();
    guardEngine.execute({ type: "MoveEast" });
    guardEngine.execute({ type: "SelectCombatAction", actionKind: "guard" });
    expect(guardEngine.getSnapshot().stats.resources.sp).toBe(10);

    const focusEngine = createEngine();
    focusEngine.execute({ type: "MoveEast" });
    focusEngine.execute({ type: "SelectCombatAction", actionKind: "focus" });
    expect(focusEngine.getSnapshot().stats.resources.sp).toBe(5);
  });

  it("reduces the next enemy attack damage while guarding", () => {
    const unguardedEngine = createEngine();
    unguardedEngine.execute({ type: "MoveEast" });
    unguardedEngine.execute({ type: "SelectCombatAction", actionKind: "strike" });
    unguardedEngine.execute({
      type: "SubmitCombatQte",
      completed: true,
      inputAdvantage: 2,
      mistakes: 0,
    });
    unguardedEngine.execute({ type: "StartOpponentTurn" });
    unguardedEngine.execute({
      type: "SubmitCombatQte",
      completed: false,
      inputAdvantage: -6,
      mistakes: 0,
    });

    const guardedEngine = createEngine();
    guardedEngine.execute({ type: "MoveEast" });
    guardedEngine.execute({ type: "SelectCombatAction", actionKind: "guard" });
    guardedEngine.execute({ type: "StartOpponentTurn" });
    guardedEngine.execute({
      type: "SubmitCombatQte",
      completed: false,
      inputAdvantage: -6,
      mistakes: 0,
    });

    expect(unguardedEngine.getSnapshot().stats.resources.hp).toBe(98);
    expect(guardedEngine.getSnapshot().stats.resources.hp).toBe(99);
    expect(guardedEngine.getSnapshot().combatState!.phase).toBe("action_selection");
  });

  it("boosts the next offensive action after focusing", () => {
    const engine = createEngine();
    engine.execute({ type: "MoveEast" });
    engine.execute({ type: "SelectCombatAction", actionKind: "focus" });
    engine.execute({ type: "StartOpponentTurn" });
    engine.execute({
      type: "SubmitCombatQte",
      completed: true,
      inputAdvantage: 5,
      mistakes: 0,
    });
    engine.execute({ type: "SelectCombatAction", actionKind: "strike" });
    engine.execute({
      type: "SubmitCombatQte",
      completed: true,
      inputAdvantage: 2,
      mistakes: 0,
    });

    expect(engine.getSnapshot().combatState!.opponentStats.resources.hp).toBe(5);
  });

  it("uses and consumes a healing item during combat", () => {
    const save = createEngine().createSaveData();
    save.stats.resources.hp = 80;
    const engine = GameplayEngine.fromSaveData(save, {
      random: () => 0.5,
      resolveZone: () => loadZone(movementZoneData),
    });

    engine.execute({ type: "MoveEast" });
    const result = engine.execute({ type: "UseItem", itemId: "travel_ration" });

    const snapshot = engine.getSnapshot();
    expect(result.success).toBe(true);
    expect(result.effects).toEqual([
      { type: "ItemUsed", itemId: "travel_ration", hpRestored: 10 },
    ]);
    expect(snapshot.stats.resources.hp).toBe(90);
    expect(snapshot.inventory.items.find((item) => item.itemId === "travel_ration")?.quantity).toBe(2);
    expect(snapshot.combatState!.phase).toBe("opponent_turn_transition");
  });

  it("rejects invalid combat actions without breaking the encounter", () => {
    const engine = createEngine();
    engine.execute({ type: "MoveEast" });

    const result = engine.execute({
      type: "SelectCombatAction",
      actionKind: "dance",
    } as never);

    const snapshot = engine.getSnapshot();
    expect(result.success).toBe(false);
    expect(snapshot.combatState!.phase).toBe("action_selection");
    expect(snapshot.log.map((entry) => entry.message)).toContain(
      "Unknown combat action.",
    );
  });
});
