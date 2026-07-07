import { describe, expect, it } from "vitest";
import { GameplayEngine } from "../GameplayEngine";
import { GameMap } from "../GameMap";
import type { ZoneData } from "../ZoneTypes";

const mockZone: ZoneData = {
  version: "1.0",
  zoneId: "test_zone",
  name: "Test Area",
  width: 5,
  height: 5,
  playerStart: { x: 2, y: 2 },
  tiles: [
    [0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0],
  ],
  npcs: [],
  items: [],
  transitions: [],
};

const mockConfig = {
  actions: {
    rest: { energyRestore: 15 },
    study: {
      energyCost: 10,
      academicProgressGain: 15,
      intelligenceGain: 1,
    },
  },
  newGame: {
    startingCurrency: 0,
    maxEnergy: 100,
    startingInventory: [],
    attributes: {
      strength: 10,
      vitality: 10,
      agility: 10,
      intelligence: 10,
      spirit: 10,
      willpower: 10,
      perception: 10,
      charisma: 10,
    },
    skills: {
      melee: 1,
      ranged: 1,
      guard: 1,
      evasion: 1,
      spellcasting: 1,
      focus: 1,
      athletics: 1,
      scholarship: 1,
      speech: 1,
    },
  },
};

function createEngine() {
  const map = new GameMap(mockZone);
  return new GameplayEngine(map, {
    resolveZone: () => map,
    actions: mockConfig.actions,
    newGame: mockConfig.newGame,
  });
}

describe("Command Mastery Gameplay", () => {
  it("initializes with level 0 mastery and advances on usage", () => {
    const engine = createEngine();
    
    // Decrease energy by saving, modifying the save payload, and restoring.
    const save = engine.createSaveData();
    save.stats.resources.energy = 50;
    
    const map = new GameMap(mockZone);
    const energyEngine = GameplayEngine.fromSaveData(save, {
      resolveZone: () => map,
      actions: mockConfig.actions,
      newGame: mockConfig.newGame,
    });

    let snapshot = energyEngine.getSnapshot();
    expect(snapshot.statLayers.masteries.rest).toEqual({ level: 0, usage: 0 });

    // We need 6 rests to level up.
    for (let i = 0; i < 5; i++) {
      energyEngine.execute({ type: "Rest" });
      snapshot = energyEngine.getSnapshot();
      expect(snapshot.statLayers.masteries.rest.level).toBe(0);
      expect(snapshot.statLayers.masteries.rest.usage).toBe(i + 1);
    }

    // 6th rest should level up Rest mastery
    energyEngine.execute({ type: "Rest" });
    snapshot = energyEngine.getSnapshot();
    expect(snapshot.statLayers.masteries.rest.level).toBe(1);
    expect(snapshot.statLayers.masteries.rest.usage).toBe(0);

    // Verify toast notice was queued
    const notices = energyEngine.consumeNotices();
    expect(notices).toContainEqual(
      expect.objectContaining({
        title: "Command Mastery Up",
        message: "Your mastery of Rest has increased to level 1!",
      })
    );
  });

  it("persists command masteries in save/load", () => {
    const engine = createEngine();
    
    const saveSetup = engine.createSaveData();
    saveSetup.stats.resources.energy = 50;
    
    const mapSetup = new GameMap(mockZone);
    const testEngine = GameplayEngine.fromSaveData(saveSetup, {
      resolveZone: () => mapSetup,
      actions: mockConfig.actions,
      newGame: mockConfig.newGame,
    });

    // Rest 6 times to level up Rest mastery to 1.
    for (let i = 0; i < 6; i++) {
      testEngine.execute({ type: "Rest" });
    }
    // Rest 1 more time so usage is 1
    testEngine.execute({ type: "Rest" });

    let snapshot = testEngine.getSnapshot();
    expect(snapshot.statLayers.masteries.rest).toEqual({ level: 1, usage: 1 });

    // Save and load
    const save = testEngine.createSaveData();
    const map = new GameMap(mockZone);
    const restored = GameplayEngine.fromSaveData(save, {
      resolveZone: () => map,
      actions: mockConfig.actions,
      newGame: mockConfig.newGame,
    });

    const restoredSnapshot = restored.getSnapshot();
    expect(restoredSnapshot.statLayers.masteries.rest).toEqual({ level: 1, usage: 1 });
  });
});
