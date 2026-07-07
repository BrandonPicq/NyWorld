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
    rest: { energyRestore: 15, xp: 2 },
    study: {
      energyCost: 10,
      academicProgressGain: 15,
      intelligenceGain: 1,
      timeCostMinutes: 120,
      xp: 10,
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

  describe("Study Gating and Mechanics", () => {
    it("refuses to study when not on a study spot", () => {
      // player starts at (2,2) which is tile 0 (floor, studySpot undefined)
      const engine = createEngine();
      const result = engine.execute({ type: "Study" });
      expect(result.success).toBe(false);
      const messages = engine.getSnapshot().log.map(entry => entry.message);
      expect(messages).toContain("You can only study in a proper study environment.");
    });

    it("succeeds when on a study spot, consumes energy, advances time, and awards XP", () => {
      // Create a zone where player start is tile 2 (study desk)
      const studyZone: ZoneData = {
        version: "1.0",
        zoneId: "study_zone",
        name: "Library",
        width: 3,
        height: 3,
        playerStart: { x: 1, y: 1 },
        tiles: [
          [2, 2, 2],
          [2, 2, 2],
          [2, 2, 2],
        ],
        npcs: [],
        items: [],
        transitions: [],
      };

      const map = new GameMap(studyZone);
      const engine = new GameplayEngine(map, {
        resolveZone: () => map,
        actions: mockConfig.actions,
        newGame: mockConfig.newGame,
      });

      // Initial state checks
      const initialSnapshot = engine.getSnapshot();
      expect(initialSnapshot.stats.resources.energy).toBe(100);
      expect(initialSnapshot.worldTime.timeLabel).toBe("08:00");
      expect(initialSnapshot.statLayers.globalXp).toBe(0);

      // Study
      const result = engine.execute({ type: "Study" });
      expect(result.success).toBe(true);

      const snapshot = engine.getSnapshot();
      // energyCost = 10 -> energy should be 90
      expect(snapshot.stats.resources.energy).toBe(90);
      // timeCostMinutes = 120 -> time should advance by 2 hours (08:00 -> 10:00)
      expect(snapshot.worldTime.timeLabel).toBe("10:00");
      // xp = 10 -> xp should be 10 (base 10 + 2 * studyMastery level 0)
      expect(snapshot.statLayers.globalXp).toBe(10);
      // mastery usage should be incremented to 1
      expect(snapshot.statLayers.masteries.study.usage).toBe(1);
    });
  });
});
