import { describe, expect, it } from "vitest";
import testZoneData from "../content/zones/test_zone.json";
import testZone2Data from "../content/zones/test_zone_2.json";
import { getDialogue } from "./dialogues/dialogueRegistry";
import { SAVE_VERSION } from "./GameSaveData";
import { GameplayEngine } from "./GameplayEngine";
import type { ZoneData } from "./ZoneTypes";
import {
  START_WORLD_TIME_MINUTES,
  WORLD_TIME_ACTION_COST,
  encodeWorldDateTime,
  formatWorldDateTime,
} from "./time/WorldCalendar";
import { loadZone } from "./zoneLoader";

const zoneData = {
  version: "0.1",
  zoneId: "movement_test",
  name: "Movement Test",
  width: 4,
  height: 4,
  playerStart: { x: 1, y: 1 },
  tiles: [
    [1, 1, 1, 1],
    [1, 0, 0, 1],
    [1, 0, 0, 1],
    [1, 1, 1, 1],
  ],
};

function createEngine() {
  return new GameplayEngine(loadZone(zoneData));
}

const adjacentNpc = {
  npcId: "old_scholar",
  x: 2,
  y: 1,
};

function createScheduledYoungPageMap() {
  return loadZone({
    ...zoneData,
    npcs: [
      {
        npcId: "young_page",
        x: 2,
        y: 1,
        schedule: [
          { time: "08:00", x: 2, y: 1, dialogueId: "young_page.default" },
          { time: "18:00", x: 1, y: 2, dialogueId: "young_page.evening" },
        ],
      },
    ],
  });
}

function createCrossZoneYoungPageMaps() {
  const schedule = [
    {
      time: "08:00",
      zoneId: "movement_test",
      x: 2,
      y: 1,
      dialogueId: "young_page.default",
    },
    {
      time: "18:00",
      zoneId: "away_zone",
      x: 2,
      y: 1,
      dialogueId: "young_page.evening",
    },
  ];

  return {
    movementMap: loadZone({
      ...zoneData,
      npcs: [{ npcId: "young_page", x: 2, y: 1, schedule }],
    }),
    awayMap: loadZone({
      ...zoneData,
      zoneId: "away_zone",
      name: "Away Zone",
      npcs: [{ npcId: "young_page", x: 2, y: 1, schedule }],
    }),
  };
}

describe("GameplayEngine", () => {
  it("moves the player with cardinal commands", () => {
    const engine = createEngine();

    expect(engine.execute({ type: "MoveEast" }).success).toBe(true);
    expect(engine.execute({ type: "MoveSouth" }).success).toBe(true);

    expect(engine.getSnapshot()).toMatchObject({
      playerX: 2,
      playerY: 2,
      tick: 2,
    });
  });

  it("starts the world calendar in year 425", () => {
    const engine = createEngine();

    expect(engine.getSnapshot().worldTime).toMatchObject({
      totalMinutes: START_WORLD_TIME_MINUTES,
      year: 425,
      month: 1,
      monthName: "Aubeclat",
      day: 1,
      hour: 8,
      minute: 0,
      dateLabel: "1 Aubeclat 425",
      timeLabel: "08:00",
    });
  });

  it("advances world time with successful player actions", () => {
    const engine = createEngine();

    engine.execute({ type: "MoveEast" });
    expect(engine.getSnapshot().worldTime.totalMinutes).toBe(
      START_WORLD_TIME_MINUTES + WORLD_TIME_ACTION_COST.movement,
    );
    expect(engine.getSnapshot().worldTime.timeLabel).toBe("08:10");

    engine.execute({ type: "Rest" });
    expect(engine.getSnapshot().worldTime.totalMinutes).toBe(
      START_WORLD_TIME_MINUTES +
        WORLD_TIME_ACTION_COST.movement +
        WORLD_TIME_ACTION_COST.rest,
    );
    expect(engine.getSnapshot().worldTime.timeLabel).toBe("09:10");
  });

  it("tracks the player facing from the latest movement command", () => {
    const engine = createEngine();

    expect(engine.getSnapshot().playerFacing).toBe("south");

    expect(engine.execute({ type: "MoveNorth" }).success).toBe(false);
    expect(engine.getSnapshot()).toMatchObject({
      playerX: 1,
      playerY: 1,
      playerFacing: "north",
      tick: 0,
    });

    expect(engine.execute({ type: "MoveEast" }).success).toBe(true);
    expect(engine.getSnapshot()).toMatchObject({
      playerX: 2,
      playerY: 1,
      playerFacing: "east",
      tick: 1,
    });
  });

  it("blocks movement into non-walkable tiles without advancing the tick", () => {
    const engine = createEngine();

    expect(engine.execute({ type: "MoveWest" }).success).toBe(false);

    expect(engine.getSnapshot()).toMatchObject({
      playerX: 1,
      playerY: 1,
      tick: 0,
    });
  });

  it("records movement and blocked movement in the action log", () => {
    const engine = createEngine();

    engine.execute({ type: "MoveEast" });
    engine.execute({ type: "MoveEast" });

    expect(engine.getSnapshot().log.map((entry) => entry.message)).toEqual([
      "Entered Movement Test.",
      "Moved east to (2, 1).",
      "Cannot move east — blocked at (3, 1).",
    ]);
  });

  it("exposes pending zone entry dialogue until it is acknowledged", () => {
    const engine = new GameplayEngine(
      loadZone({
        ...zoneData,
        entryDialogue: [
          { speaker: "Narrator", text: "The test begins.", pitch: 1 },
        ],
      }),
    );

    expect(engine.getSnapshot().entryDialogue).toEqual([
      { speaker: "Narrator", text: "The test begins.", pitch: 1 },
    ]);
    expect(engine.execute({ type: "AcknowledgeZoneEntryDialogue" })).toEqual({
      success: true,
    });
    expect(engine.getSnapshot().entryDialogue).toEqual([]);
    expect(engine.execute({ type: "AcknowledgeZoneEntryDialogue" })).toEqual({
      success: false,
    });
  });

  it("detects a pending transition at the player position", () => {
    const engine = new GameplayEngine(
      loadZone({
        ...zoneData,
        transitions: [
          {
            targetX: 1,
            targetY: 1,
            targetZoneId: "next_zone",
            x: 2,
            y: 1,
          },
        ],
      }),
    );

    engine.execute({ type: "MoveEast" });

    expect(engine.getPendingTransition()).toEqual({
      targetX: 1,
      targetY: 1,
      targetZoneId: "next_zone",
      x: 2,
      y: 1,
    });
  });

  it("enters another zone at the requested entry position", () => {
    const engine = createEngine();
    const nextMap = loadZone({
      ...zoneData,
      name: "Next Zone",
      playerStart: { x: 2, y: 2 },
      zoneId: "next_zone",
    });

    engine.enterZone(nextMap, 2, 1);

    expect(engine.getSnapshot()).toMatchObject({
      playerX: 2,
      playerY: 1,
      tick: 0,
      zoneId: "next_zone",
      zoneName: "Next Zone",
    });
    expect(engine.getSnapshot().log.map((entry) => entry.message)).toEqual([
      "Entered Movement Test.",
      "Entered Next Zone.",
    ]);
  });

  it("resolves transitions after successful movement", () => {
    const nextMap = loadZone({
      ...zoneData,
      entryDialogue: [
        { speaker: "Narrator", text: "A new room unfolds.", pitch: 1 },
      ],
      name: "Next Zone",
      playerStart: { x: 1, y: 1 },
      zoneId: "next_zone",
    });
    const engine = new GameplayEngine(
      loadZone({
        ...zoneData,
        transitions: [
          {
            targetX: 2,
            targetY: 1,
            targetZoneId: "next_zone",
            x: 2,
            y: 1,
          },
        ],
      }),
      {
        resolveZone: (zoneId) => (zoneId === "next_zone" ? nextMap : undefined),
      },
    );

    engine.execute({ type: "MoveEast" });

    expect(engine.getSnapshot()).toMatchObject({
      playerX: 2,
      playerY: 1,
      tick: 1,
      zoneId: "next_zone",
      zoneName: "Next Zone",
      entryDialogue: [
        { speaker: "Narrator", text: "A new room unfolds.", pitch: 1 },
      ],
    });
    expect(engine.getSnapshot().log.map((entry) => entry.message)).toEqual([
      "Entered Movement Test.",
      "Moved east to (2, 1).",
      "Entered Next Zone.",
    ]);
  });

  it("does not replay a zone entry dialogue after the zone entry event was seen", () => {
    const firstMap = loadZone({
      ...zoneData,
      entryDialogue: [
        { speaker: "Narrator", text: "First arrival.", pitch: 1 },
      ],
    });
    const secondMap = loadZone({
      ...zoneData,
      entryDialogue: [
        { speaker: "Narrator", text: "Second arrival.", pitch: 1 },
      ],
      name: "Second Zone",
      zoneId: "second_zone",
    });
    const engine = new GameplayEngine(firstMap);

    expect(engine.getSnapshot().entryDialogue).toEqual([
      { speaker: "Narrator", text: "First arrival.", pitch: 1 },
    ]);
    engine.execute({ type: "AcknowledgeZoneEntryDialogue" });

    engine.enterZone(secondMap, 1, 1);
    expect(engine.getSnapshot().entryDialogue).toEqual([
      { speaker: "Narrator", text: "Second arrival.", pitch: 1 },
    ]);
    engine.execute({ type: "AcknowledgeZoneEntryDialogue" });

    engine.enterZone(firstMap, 1, 1);
    expect(engine.getSnapshot().entryDialogue).toEqual([]);
  });

  it("resolves an edge transition before the next movement command", () => {
    const firstMap = loadZone({
      version: "0.1",
      zoneId: "first_zone",
      name: "First Zone",
      width: 10,
      height: 8,
      playerStart: { x: 8, y: 4 },
      tiles: [
        [1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
        [1, 0, 0, 0, 0, 0, 0, 0, 0, 1],
        [1, 0, 0, 0, 0, 0, 0, 0, 0, 1],
        [1, 0, 0, 0, 0, 0, 0, 0, 0, 1],
        [1, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        [1, 0, 0, 0, 0, 0, 0, 0, 0, 1],
        [1, 0, 0, 0, 0, 0, 0, 0, 0, 1],
        [1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
      ],
      transitions: [
        {
          targetX: 1,
          targetY: 4,
          targetZoneId: "second_zone",
          x: 9,
          y: 4,
        },
      ],
    });
    const secondMap = loadZone({
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
        [0, 0, 0, 1, 1, 1, 0, 0, 0, 1],
        [1, 0, 0, 0, 0, 0, 0, 0, 0, 1],
        [1, 0, 0, 0, 0, 0, 0, 0, 0, 1],
        [1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
      ],
    });
    const engine = new GameplayEngine(firstMap, {
      resolveZone: (zoneId) =>
        zoneId === "second_zone" ? secondMap : undefined,
    });

    engine.execute({ type: "MoveEast" });
    expect(engine.getSnapshot()).toMatchObject({
      playerX: 1,
      playerY: 4,
      tick: 1,
      zoneId: "second_zone",
    });

    engine.execute({ type: "MoveEast" });
    expect(engine.getSnapshot()).toMatchObject({
      playerX: 2,
      playerY: 4,
      tick: 2,
      zoneId: "second_zone",
    });
    expect(engine.getSnapshot().log.map((entry) => entry.message)).toEqual([
      "Entered First Zone.",
      "Moved east to (9, 4).",
      "Entered Second Zone.",
      "Moved east to (2, 4).",
    ]);
  });

  it("resolves the real test zone east transition before another east movement", () => {
    const zoneRegistry: Record<string, ZoneData> = {
      test_zone: testZoneData as ZoneData,
      test_zone_2: testZone2Data as ZoneData,
    };
    const engine = new GameplayEngine(loadZone(testZoneData), {
      resolveZone: (zoneId) => {
        const zoneData = zoneRegistry[zoneId];
        return zoneData ? loadZone(zoneData) : undefined;
      },
    });

    engine.execute({ type: "MoveEast" });
    engine.execute({ type: "MoveEast" });
    engine.execute({ type: "MoveEast" });
    engine.execute({ type: "MoveEast" });

    expect(engine.getSnapshot()).toMatchObject({
      playerX: 1,
      playerY: 4,
      tick: 4,
      zoneId: "test_zone_2",
      zoneName: "Test Zone 2",
    });

    engine.execute({ type: "MoveEast" });

    expect(engine.getSnapshot()).toMatchObject({
      playerX: 2,
      playerY: 4,
      tick: 5,
      zoneId: "test_zone_2",
      zoneName: "Test Zone 2",
    });
    expect(engine.getSnapshot().log.map((entry) => entry.message)).toEqual([
      "Entered Test Zone.",
      "Moved east to (6, 4).",
      "Moved east to (7, 4).",
      "Moved east to (8, 4).",
      "Moved east to (9, 4).",
      "Entered Test Zone 2.",
      "Moved east to (2, 4).",
    ]);
  });

  it("spawns globally scheduled NPC presence in the active content zone", () => {
    const testZone = loadZone(testZoneData);
    const testZone2 = loadZone(testZone2Data);
    const engine = new GameplayEngine(testZone);

    expect(testZone.npcs.some((npc) => npc.npcId === "young_page")).toBe(false);
    expect(
      engine.getSnapshot().entities.find((entity) => entity.npcId === "young_page"),
    ).toMatchObject({ x: 6, y: 3 });

    for (let i = 0; i < 10; i++) {
      engine.execute({ type: "Rest" });
    }

    expect(engine.getSnapshot().worldTime.timeLabel).toBe("18:00");
    expect(
      engine.getSnapshot().entities.find((entity) => entity.npcId === "young_page"),
    ).toBeUndefined();

    engine.enterZone(testZone2, 1, 1);

    expect(testZone2.npcs.some((npc) => npc.npcId === "young_page")).toBe(false);
    expect(
      engine.getSnapshot().entities.find((entity) => entity.npcId === "young_page"),
    ).toMatchObject({ x: 2, y: 6 });
  });

  it("interacts with NPCs when player collides with their tile", () => {
    const mapWithNpc = loadZone({
      ...zoneData,
      npcs: [adjacentNpc],
    });
    const engine = new GameplayEngine(mapWithNpc);

    const result = engine.execute({ type: "MoveEast" });

    expect(result.success).toBe(false);
    expect(result.dialogue).toEqual(getDialogue("old_scholar.default"));

    expect(engine.getSnapshot()).toMatchObject({
      playerX: 1,
      playerY: 1,
      tick: 0,
    });

    expect(engine.getSnapshot().log.map((entry) => entry.message)).toEqual([
      "Entered Movement Test.",
      "Talked to Old Scholar.",
    ]);
  });

  it("interacts with adjacent NPCs without moving the player", () => {
    const mapWithNpc = loadZone({
      ...zoneData,
      npcs: [adjacentNpc],
    });
    const engine = new GameplayEngine(mapWithNpc);

    const result = engine.execute({ type: "Interact" });

    expect(result.success).toBe(true);
    expect(result.dialogue).toEqual(getDialogue("old_scholar.default"));
    expect(engine.getSnapshot()).toMatchObject({
      playerX: 1,
      playerY: 1,
      tick: 0,
    });
    expect(engine.getSnapshot().log.map((entry) => entry.message)).toEqual([
      "Entered Movement Test.",
      "Talked to Old Scholar.",
    ]);
  });

  it("uses zone-specific dialogue overrides for NPC spawns", () => {
    const mapWithNpc = loadZone({
      ...zoneData,
      npcs: [
        {
          ...adjacentNpc,
          dialogueId: "old_scholar.test_fields",
        },
      ],
    });
    const engine = new GameplayEngine(mapWithNpc);

    const result = engine.execute({ type: "Interact" });

    expect(result.success).toBe(true);
    expect(result.dialogue).toEqual(getDialogue("old_scholar.test_fields"));
  });

  it("advances world time when dialogue starts without advancing the tick", () => {
    const mapWithNpc = loadZone({
      ...zoneData,
      npcs: [adjacentNpc],
    });
    const engine = new GameplayEngine(mapWithNpc);

    engine.execute({ type: "Interact" });

    expect(engine.getSnapshot()).toMatchObject({
      tick: 0,
      worldTime: {
        totalMinutes:
          START_WORLD_TIME_MINUTES + WORLD_TIME_ACTION_COST.dialogue,
        timeLabel: "08:10",
      },
    });
  });

  it("moves scheduled NPCs when world time reaches a schedule entry", () => {
    const engine = new GameplayEngine(createScheduledYoungPageMap());

    expect(
      engine.getSnapshot().entities.find((entity) => entity.npcId === "young_page"),
    ).toMatchObject({ x: 2, y: 1 });

    for (let i = 0; i < 10; i++) {
      engine.execute({ type: "Rest" });
    }

    expect(engine.getSnapshot().worldTime.timeLabel).toBe("18:00");
    expect(
      engine.getSnapshot().entities.find((entity) => entity.npcId === "young_page"),
    ).toMatchObject({ x: 1, y: 2 });
  });

  it("interacts with NPCs at their scheduled position", () => {
    const engine = new GameplayEngine(createScheduledYoungPageMap());

    for (let i = 0; i < 10; i++) {
      engine.execute({ type: "Rest" });
    }

    const result = engine.execute({ type: "MoveSouth" });

    expect(result.success).toBe(false);
    expect(result.dialogue).toEqual(getDialogue("young_page.evening"));
    expect(engine.getSnapshot()).toMatchObject({
      playerX: 1,
      playerY: 1,
    });
    expect(engine.getSnapshot().log.map((entry) => entry.message)).toContain(
      "Talked to Young Page.",
    );
  });

  it("removes scheduled NPCs from the current zone when their active schedule targets another zone", () => {
    const { movementMap, awayMap } = createCrossZoneYoungPageMaps();
    const engine = new GameplayEngine(movementMap);

    expect(
      engine.getSnapshot().entities.find((entity) => entity.npcId === "young_page"),
    ).toMatchObject({ x: 2, y: 1 });

    for (let i = 0; i < 10; i++) {
      engine.execute({ type: "Rest" });
    }

    expect(engine.getSnapshot().worldTime.timeLabel).toBe("18:00");
    expect(
      engine.getSnapshot().entities.find((entity) => entity.npcId === "young_page"),
    ).toBeUndefined();

    engine.enterZone(awayMap, 1, 1);

    expect(
      engine.getSnapshot().entities.find((entity) => entity.npcId === "young_page"),
    ).toMatchObject({ x: 2, y: 1 });
  });

  it("logs when interact finds nothing nearby", () => {
    const engine = createEngine();

    const result = engine.execute({ type: "Interact" });

    expect(result).toEqual({ success: false });
    expect(engine.getSnapshot()).toMatchObject({
      playerX: 1,
      playerY: 1,
      tick: 0,
    });
    expect(engine.getSnapshot().log.map((entry) => entry.message)).toEqual([
      "Entered Movement Test.",
      "There is nothing to interact with nearby.",
    ]);
  });

  it("limits interaction checks to a requested direction", () => {
    const southNpc = {
      npcId: "old_wizard",
      x: 1,
      y: 2,
    };
    const mapWithMultipleNpcs = loadZone({
      ...zoneData,
      npcs: [adjacentNpc, southNpc],
    });
    const engine = new GameplayEngine(mapWithMultipleNpcs);

    const result = engine.execute({
      type: "Interact",
      targetDirection: "south",
    });

    expect(result.success).toBe(true);
    expect(result.dialogue).toEqual(getDialogue("old_wizard.default"));
    expect(engine.getSnapshot().log.map((entry) => entry.message)).toEqual([
      "Entered Movement Test.",
      "Talked to Old Wizard.",
    ]);
  });

  it("does not interact outside a requested direction", () => {
    const mapWithNpc = loadZone({
      ...zoneData,
      npcs: [adjacentNpc],
    });
    const engine = new GameplayEngine(mapWithNpc);

    const result = engine.execute({
      type: "Interact",
      targetDirection: "south",
    });

    expect(result).toEqual({ success: false });
    expect(engine.getSnapshot().log.map((entry) => entry.message)).toEqual([
      "Entered Movement Test.",
      "There is nothing to interact with there.",
    ]);
  });

  it("resolves interaction ambiguity when multiple NPCs are adjacent", () => {
    const secondAdjacentNpc = {
      npcId: "young_page",
      x: 1,
      y: 2,
    };

    const mapWithMultipleNpcs = loadZone({
      ...zoneData,
      npcs: [adjacentNpc, secondAdjacentNpc],
    });
    const engine = new GameplayEngine(mapWithMultipleNpcs);

    // 1. Without targeted NPC ID, standard interact talks to the first found PNJ
    const result1 = engine.execute({ type: "Interact" });
    expect(result1.success).toBe(true);
    expect(result1.dialogue).toEqual(getDialogue("old_scholar.default"));

    // 2. With targeted NPC ID, interact talks specifically to the targeted PNJ
    const result2 = engine.execute({
      type: "Interact",
      targetNpcId: "young_page",
    });
    expect(result2.success).toBe(true);
    expect(result2.dialogue).toEqual(getDialogue("young_page.default"));

    expect(engine.getSnapshot().log.map((entry) => entry.message)).toEqual([
      "Entered Movement Test.",
      "Talked to Old Scholar.",
      "Talked to Young Page.",
    ]);
  });

  it("fails targeted interaction when the requested NPC is not adjacent", () => {
    const mapWithNpc = loadZone({
      ...zoneData,
      npcs: [adjacentNpc],
    });
    const engine = new GameplayEngine(mapWithNpc);

    const result = engine.execute({
      type: "Interact",
      targetNpcId: "missing_npc",
    });

    expect(result).toEqual({ success: false });
    expect(engine.getSnapshot().log.map((entry) => entry.message)).toEqual([
      "Entered Movement Test.",
      "That interaction target is no longer nearby.",
    ]);
  });

  it("renders common NPCs with a shared glyph and race color", () => {
    const mapWithNpcs = loadZone({
      ...zoneData,
      npcs: [
        { npcId: "young_page", x: 2, y: 1 },
        { npcId: "old_wizard", x: 1, y: 2 },
        { npcId: "old_scholar", x: 2, y: 2 },
      ],
    });
    const engine = new GameplayEngine(mapWithNpcs);

    const human = engine
      .getSnapshot()
      .entities.find((entity) => entity.npcId === "young_page");
    const elf = engine
      .getSnapshot()
      .entities.find((entity) => entity.npcId === "old_wizard");
    const story = engine
      .getSnapshot()
      .entities.find((entity) => entity.npcId === "old_scholar");

    expect(human).toMatchObject({ glyph: "n", color: "#f2cdcd" });
    expect(elf).toMatchObject({ glyph: "n", color: "#a6e3a1" });
    expect(story).toMatchObject({ glyph: "S", color: "#ffb000" });
  });

  it("initializes persistent NPC state for known NPC definitions", () => {
    const engine = createEngine();

    expect(engine.getNpcState("old_scholar")).toEqual({
      npcId: "old_scholar",
      relationship: 0,
      progressionLevel: 1,
      currentRole: "resident",
      knownFlags: [],
    });
    expect(engine.getSnapshot().npcStates.map((state) => state.npcId)).toEqual([
      "old_scholar",
      "old_wizard",
      "slime",
      "young_page",
    ]);
  });

  it("protects NPC state from external mutations", () => {
    const engine = createEngine();

    const state = engine.getNpcState("old_scholar");
    state!.relationship = 99;
    state!.knownFlags.push("external_change");

    expect(engine.getNpcState("old_scholar")).toEqual({
      npcId: "old_scholar",
      relationship: 0,
      progressionLevel: 1,
      currentRole: "resident",
      knownFlags: [],
    });
  });

  it("exposes starter inventory items in snapshots", () => {
    const engine = createEngine();

    expect(engine.getSnapshot().inventory.items).toEqual([
      { itemId: "academy_notebook", quantity: 1 },
      { itemId: "travel_ration", quantity: 3 },
      { itemId: "chalk_piece", quantity: 2 },
    ]);
  });

  it("exposes structured starter character stats in snapshots", () => {
    const engine = createEngine();

    expect(engine.getSnapshot().stats).toMatchObject({
      resources: {
        hp: 100,
        maxHp: 100,
        mp: 70,
        maxMp: 70,
        sp: 0,
        maxSp: 100,
        energy: 100,
        maxEnergy: 100,
      },
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
      combat: {
        attack: 10,
        magicAttack: 10,
        defense: 10,
        magicDefense: 10,
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
      progression: {
        academicTitle: "Novice Scribe",
        academicProgress: 0,
      },
      conditions: [],
    });
  });

  it("protects engine stats state from snapshot mutations", () => {
    const engine = createEngine();
    const snapshot = engine.getSnapshot();

    snapshot.stats.resources.energy = 1;
    snapshot.stats.attributes.intelligence = 99;
    snapshot.stats.skills.scholarship = 99;
    snapshot.stats.conditions.push({ id: "external_change", name: "External Change" });

    expect(engine.getSnapshot().stats).toMatchObject({
      resources: { energy: 100 },
      attributes: { intelligence: 10 },
      skills: { scholarship: 1 },
      conditions: [],
    });
  });

  it("protects engine inventory state from snapshot mutations", () => {
    const engine = createEngine();
    const snapshot = engine.getSnapshot();

    snapshot.inventory.items[0].quantity = 99;
    snapshot.inventory.items.push({
      itemId: "external_item",
      quantity: 1,
    });

    expect(engine.getSnapshot().inventory.items).toEqual([
      { itemId: "academy_notebook", quantity: 1 },
      { itemId: "travel_ration", quantity: 3 },
      { itemId: "chalk_piece", quantity: 2 },
    ]);
  });

  it("picks up ground items on collision and adds a new stack", () => {
    const mapWithItem = loadZone({
      ...zoneData,
      items: [{ itemId: "healing_herb", x: 2, y: 1, quantity: 1 }],
    });
    const engine = new GameplayEngine(mapWithItem);

    const result = engine.execute({ type: "MoveEast" });

    expect(result.success).toBe(true);
    expect(engine.getSnapshot()).toMatchObject({
      playerX: 2,
      playerY: 1,
      tick: 1,
    });

    const herbStacks = engine
      .getSnapshot()
      .inventory.items.filter((s) => s.itemId === "healing_herb");

    expect(herbStacks).toEqual([{ itemId: "healing_herb", quantity: 1 }]);
    expect(engine.getSnapshot().log.map((e) => e.message)).toEqual([
      "Entered Movement Test.",
      "Moved east to (2, 1).",
      "Picked up Healing Herb.",
    ]);
  });

  it("merges into an existing stack when picking up a known item", () => {
    const mapWithItem = loadZone({
      ...zoneData,
      items: [{ itemId: "chalk_piece", x: 2, y: 1, quantity: 1 }],
    });
    const engine = new GameplayEngine(mapWithItem);

    engine.execute({ type: "MoveEast" });

    const chalkStacks = engine
      .getSnapshot()
      .inventory.items.filter((s) => s.itemId === "chalk_piece");

    expect(chalkStacks).toEqual([{ itemId: "chalk_piece", quantity: 3 }]);
  });

  it("does not respawn picked up items after re-entering a zone", () => {
    const mapWithItem = loadZone({
      ...zoneData,
      items: [{ itemId: "healing_herb", x: 2, y: 1, quantity: 1 }],
    });
    const engine = new GameplayEngine(mapWithItem);

    engine.execute({ type: "MoveEast" });
    engine.enterZone(mapWithItem, 1, 1);
    engine.execute({ type: "MoveEast" });

    const herbStacks = engine
      .getSnapshot()
      .inventory.items.filter((s) => s.itemId === "healing_herb");

    expect(herbStacks).toEqual([{ itemId: "healing_herb", quantity: 1 }]);
  });

  it("spawns ground items with a shared glyph and category color", () => {
    const mapWithItems = loadZone({
      ...zoneData,
      items: [
        { itemId: "chalk_piece", x: 2, y: 1, quantity: 1 },
        { itemId: "old_coin", x: 2, y: 2, quantity: 1 },
        { itemId: "academy_notebook", x: 1, y: 2, quantity: 1 },
      ],
    });
    const engine = new GameplayEngine(mapWithItems);

    const entities = engine.getSnapshot().entities;

    for (const entity of entities) {
      expect(entity.glyph).toBe("*");
    }

    const chalk = entities.find((e) => e.x === 2 && e.y === 1);
    const coin = entities.find((e) => e.x === 2 && e.y === 2);
    const notebook = entities.find((e) => e.x === 1 && e.y === 2);

    expect(chalk?.color).toBe("#cdd6f4");
    expect(coin?.color).toBe("#f9e2af");
    expect(notebook?.color).toBe("#cba6f7");
  });

  it("returns an ItemCollected effect when picking up a ground item", () => {
    const mapWithItem = loadZone({
      ...zoneData,
      items: [{ itemId: "chalk_piece", x: 2, y: 1, quantity: 1 }],
    });
    const engine = new GameplayEngine(mapWithItem);

    const result = engine.execute({ type: "MoveEast" });

    expect(result.effects).toEqual([
      { type: "ItemCollected", itemId: "chalk_piece", quantity: 1 },
    ]);
  });

  it("returns no pickup effect when moving onto an empty tile", () => {
    const engine = createEngine();

    const result = engine.execute({ type: "MoveEast" });

    expect(result.effects).toBeUndefined();
  });

  describe("Study", () => {
    it("spends time and energy to improve academic stats", () => {
      const engine = createEngine();

      const result = engine.execute({ type: "Study" });

      expect(result.success).toBe(true);
      expect(engine.getSnapshot()).toMatchObject({
        tick: 1,
        worldTime: {
          totalMinutes: START_WORLD_TIME_MINUTES + WORLD_TIME_ACTION_COST.study,
          timeLabel: "09:30",
        },
        stats: {
          resources: {
            energy: 90,
          },
          progression: {
            academicProgress: 15,
          },
        },
      });
      expect(engine.getSnapshot().stats.attributes.intelligence).toBe(11);
      expect(engine.getSnapshot().stats.skills.scholarship).toBe(16);
      expect(engine.getSnapshot().log.map((entry) => entry.message)).toContain(
        "Studied old notes. Intelligence +1, scholarship +15, academic progress +15%.",
      );
    });

    it("rejects study without enough energy", () => {
      const engine = createEngine();
      const save = engine.createSaveData();
      save.stats.resources.energy = 9;

      const restored = GameplayEngine.fromSaveData(save, {
        resolveZone: (zoneId) =>
          zoneId === "movement_test" ? loadZone(zoneData) : undefined,
      });

      const result = restored.execute({ type: "Study" });

      expect(result.success).toBe(false);
      expect(restored.getSnapshot()).toMatchObject({
        tick: 0,
        worldTime: {
          totalMinutes: START_WORLD_TIME_MINUTES,
        },
        stats: {
          resources: {
            energy: 9,
          },
          progression: {
            academicProgress: 0,
          },
        },
      });
      expect(restored.getSnapshot().stats.attributes.intelligence).toBe(10);
      expect(restored.getSnapshot().stats.skills.scholarship).toBe(1);
      expect(restored.getSnapshot().log.map((entry) => entry.message)).toContain(
        "You are too exhausted to study. Rest [R] to recover energy.",
      );
    });
  });

  describe("UseItem", () => {
    it("restores energy when using a consumable", () => {
      const engine = createEngine();

      const directions = ["MoveEast", "MoveSouth", "MoveWest", "MoveNorth"] as const;
      for (let i = 0; i < 10; i++) {
        engine.execute({ type: directions[i % 4] });
      }

      expect(engine.getSnapshot().stats.resources.energy).toBe(90);

      engine.execute({ type: "UseItem", itemId: "travel_ration" });

      expect(engine.getSnapshot().stats.resources.energy).toBe(100);
    });

    it("reports the actual restored energy when capped by max energy", () => {
      const engine = createEngine();

      const directions = ["MoveEast", "MoveSouth", "MoveWest", "MoveNorth"] as const;
      for (let i = 0; i < 5; i++) {
        engine.execute({ type: directions[i % 4] });
      }

      expect(engine.getSnapshot().stats.resources.energy).toBe(95);

      const result = engine.execute({ type: "UseItem", itemId: "travel_ration" });

      expect(engine.getSnapshot().stats.resources.energy).toBe(100);
      expect(result.effects).toEqual([
        { type: "ItemUsed", itemId: "travel_ration", energyRestored: 5 },
      ]);
      expect(engine.getSnapshot().log.map((e) => e.message)).toContain(
        "Used Travel Ration. Recovered 5 energy.",
      );
    });

    it("decrements the stack quantity when using a consumable", () => {
      const engine = createEngine();

      const directions = ["MoveEast", "MoveSouth", "MoveWest", "MoveNorth"] as const;
      for (let i = 0; i < 10; i++) {
        engine.execute({ type: directions[i % 4] });
      }

      engine.execute({ type: "UseItem", itemId: "travel_ration" });

      const stacks = engine
        .getSnapshot()
        .inventory.items.filter((s) => s.itemId === "travel_ration");

      expect(stacks).toEqual([{ itemId: "travel_ration", quantity: 2 }]);
    });

    it("removes the stack when quantity reaches zero", () => {
      const engine = createEngine();
      const directions = ["MoveEast", "MoveSouth", "MoveWest", "MoveNorth"] as const;

      for (let i = 0; i < 10; i++) {
        engine.execute({ type: directions[i % 4] });
      }
      engine.execute({ type: "UseItem", itemId: "travel_ration" });

      for (let i = 0; i < 10; i++) {
        engine.execute({ type: directions[i % 4] });
      }
      engine.execute({ type: "UseItem", itemId: "travel_ration" });

      for (let i = 0; i < 10; i++) {
        engine.execute({ type: directions[i % 4] });
      }
      engine.execute({ type: "UseItem", itemId: "travel_ration" });

      const stacks = engine
        .getSnapshot()
        .inventory.items.filter((s) => s.itemId === "travel_ration");

      expect(stacks).toEqual([]);
    });

    it("fails gracefully when the item is not in the inventory", () => {
      const engine = createEngine();

      const result = engine.execute({ type: "UseItem", itemId: "nonexistent" });

      expect(result.success).toBe(false);
      expect(result.effects).toBeUndefined();
      expect(engine.getSnapshot().log.map((e) => e.message)).toContain(
        "You don't have that item.",
      );
    });

    it("fails gracefully when the item is not a consumable", () => {
      const engine = createEngine();

      const result = engine.execute({ type: "UseItem", itemId: "academy_notebook" });

      expect(result.success).toBe(false);
      expect(result.effects).toBeUndefined();
      expect(engine.getSnapshot().log.map((e) => e.message)).toContain(
        "Academy Notebook cannot be used.",
      );
    });

    it("returns an ItemUsed effect only on success", () => {
      const engine = createEngine();
      const directions = ["MoveEast", "MoveSouth", "MoveWest", "MoveNorth"] as const;

      for (let i = 0; i < 10; i++) {
        engine.execute({ type: directions[i % 4] });
      }

      const success = engine.execute({ type: "UseItem", itemId: "travel_ration" });
      expect(success.effects).toEqual([
        { type: "ItemUsed", itemId: "travel_ration", energyRestored: 10 },
      ]);

      const fail = engine.execute({ type: "UseItem", itemId: "academy_notebook" });
      expect(fail.effects).toBeUndefined();
    });

    it("rejects usage when energy is already at maximum", () => {
      const engine = createEngine();

      const directions = ["MoveEast", "MoveSouth", "MoveWest", "MoveNorth"] as const;
      for (let i = 0; i < 10; i++) {
        engine.execute({ type: directions[i % 4] });
      }

      engine.execute({ type: "UseItem", itemId: "travel_ration" });

      const result = engine.execute({ type: "UseItem", itemId: "travel_ration" });

      expect(result.success).toBe(false);
      expect(result.effects).toEqual([
        {
          type: "ItemUseRejected",
          itemId: "travel_ration",
          reason: "energy_full",
          message: "Travel Ration would have no effect right now.",
        },
      ]);

      const stacks = engine
        .getSnapshot()
        .inventory.items.filter((s) => s.itemId === "travel_ration");

      expect(stacks).toEqual([{ itemId: "travel_ration", quantity: 2 }]);
      expect(engine.getSnapshot().tick).toBe(11);
      expect(engine.getSnapshot().log.map((e) => e.message)).toContain(
        "Travel Ration would have no effect right now.",
      );
    });
  });

  describe("SaveData", () => {
    it("createSaveData captures zone, tick, world time, position, facing, stats, inventory, and NPC state", () => {
      const engine = createEngine();
      engine.execute({ type: "MoveEast" });
      engine.execute({ type: "MoveSouth" });

      const save = engine.createSaveData();

      expect(save.version).toBe(SAVE_VERSION);
      expect(save.zoneId).toBe("movement_test");
      expect(save.tick).toBe(2);
      expect(formatWorldDateTime(save.worldTimeMinutes)).toBe(
        "1 Aubeclat 425, 08:20",
      );
      expect(save.playerX).toBe(2);
      expect(save.playerY).toBe(2);
      expect(save.playerFacing).toBe("south");
      expect(save.stats.resources.energy).toBe(98);
      expect(save.stats.resources.maxEnergy).toBe(100);
      expect(save.stats.resources.maxHp).toBe(100);
      expect(save.stats.combat.attack).toBe(10);
      expect(save.stats.skills.scholarship).toBe(1);
      expect(save.stats.progression.academicTitle).toBe("Novice Scribe");
      expect(save.inventory.items).toHaveLength(3);
      expect(save.npcStates).toContainEqual({
        npcId: "old_scholar",
        relationship: 0,
        progressionLevel: 1,
        currentRole: "resident",
        knownFlags: [],
      });
      expect(save.log.length).toBeGreaterThan(0);
      expect(save.pickedUpItemSpawnKeys).toEqual([]);
    });

    it("createSaveData includes collected item spawn keys", () => {
      const mapWithItem = loadZone({
        ...zoneData,
        items: [{ itemId: "healing_herb", x: 2, y: 1, quantity: 1 }],
      });
      const engine = new GameplayEngine(mapWithItem);
      engine.execute({ type: "MoveEast" });

      const save = engine.createSaveData();

      expect(save.pickedUpItemSpawnKeys).toHaveLength(1);
      expect(save.pickedUpItemSpawnKeys[0]).toContain("healing_herb");
      expect(save.pickedUpItemSpawnKeys[0]).toContain("2,1");
    });

    it("createSaveData includes seen zone entry event ids", () => {
      const engine = new GameplayEngine(
        loadZone({
          ...zoneData,
          entryDialogue: [
            { speaker: "Narrator", text: "Seen once.", pitch: 1 },
          ],
        }),
      );

      const save = engine.createSaveData();

      expect(save.seenZoneEntryEventIds).toEqual(["zone_entry:movement_test"]);
    });

    it("fromSaveData restores tick, world time, position, facing, stats, inventory, and NPC state", () => {
      const engine = createEngine();
      engine.execute({ type: "MoveEast" });
      engine.execute({ type: "MoveSouth" });

      const save = engine.createSaveData();
      save.stats.resources.hp = 42;
      save.stats.attributes.intelligence = 14;
      save.stats.skills.scholarship = 7;
      save.stats.progression.academicProgress = 30;
      save.stats.conditions = [{ id: "tired", name: "Tired" }];
      save.npcStates = save.npcStates.map((state) =>
        state.npcId === "old_scholar"
          ? {
              ...state,
              relationship: 12,
              progressionLevel: 3,
              currentRole: "academy_mentor",
              currentDialogueId: "old_scholar.test_fields",
              knownFlags: ["met_player"],
            }
          : state,
      );

      const restored = GameplayEngine.fromSaveData(save, {
        resolveZone: (zoneId) =>
          zoneId === "movement_test" ? loadZone(zoneData) : undefined,
      });

      const snap = restored.getSnapshot();
      expect(snap.tick).toBe(2);
      expect(snap.worldTime.timeLabel).toBe("08:20");
      expect(snap.playerX).toBe(2);
      expect(snap.playerY).toBe(2);
      expect(snap.playerFacing).toBe("south");
      expect(snap.stats.resources.energy).toBe(98);
      expect(snap.stats.resources.hp).toBe(42);
      expect(snap.stats.attributes.intelligence).toBe(14);
      expect(snap.stats.skills.scholarship).toBe(7);
      expect(snap.stats.progression.academicProgress).toBe(30);
      expect(snap.stats.conditions).toEqual([{ id: "tired", name: "Tired" }]);
      expect(snap.inventory.items).toHaveLength(3);
      expect(restored.getNpcState("old_scholar")).toEqual({
        npcId: "old_scholar",
        relationship: 12,
        progressionLevel: 3,
        currentRole: "academy_mentor",
        currentDialogueId: "old_scholar.test_fields",
        knownFlags: ["met_player"],
      });
    });

    it("fromSaveData restores NPC positions from schedules at the saved time", () => {
      const mapWithScheduledNpc = createScheduledYoungPageMap();
      const engine = new GameplayEngine(mapWithScheduledNpc);
      const save = engine.createSaveData();
      save.worldTimeMinutes = encodeWorldDateTime({
        year: 425,
        month: 1,
        day: 1,
        hour: 18,
        minute: 0,
      });

      const restored = GameplayEngine.fromSaveData(save, {
        resolveZone: (zoneId) =>
          zoneId === "movement_test" ? mapWithScheduledNpc : undefined,
      });

      expect(
        restored
          .getSnapshot()
          .entities.find((entity) => entity.npcId === "young_page"),
      ).toMatchObject({ x: 1, y: 2 });
    });

    it("fromSaveData uses saved NPC dialogue state when the zone has no override", () => {
      const mapWithNpc = loadZone({
        ...zoneData,
        npcs: [adjacentNpc],
      });
      const engine = new GameplayEngine(mapWithNpc);
      const save = engine.createSaveData();
      save.npcStates = save.npcStates.map((state) =>
        state.npcId === "old_scholar"
          ? {
              ...state,
              currentDialogueId: "old_scholar.test_fields",
            }
          : state,
      );

      const restored = GameplayEngine.fromSaveData(save, {
        resolveZone: (zoneId) =>
          zoneId === "movement_test" ? mapWithNpc : undefined,
      });

      const result = restored.execute({ type: "Interact" });

      expect(result.success).toBe(true);
      expect(result.dialogue).toEqual(getDialogue("old_scholar.test_fields"));
    });

    it("fromSaveData does not respawn already-collected items", () => {
      const mapWithItem = loadZone({
        ...zoneData,
        items: [{ itemId: "healing_herb", x: 2, y: 1, quantity: 1 }],
      });
      const engine = new GameplayEngine(mapWithItem);
      engine.execute({ type: "MoveEast" });

      const save = engine.createSaveData();
      expect(save.pickedUpItemSpawnKeys).toHaveLength(1);

      const restored = GameplayEngine.fromSaveData(save, {
        resolveZone: (zoneId) =>
          zoneId === "movement_test" ? mapWithItem : undefined,
      });

      const afterSnap = restored.getSnapshot();
      expect(afterSnap.playerX).toBe(2);
      expect(afterSnap.playerY).toBe(1);

      const herbEntities = afterSnap.entities.filter(
        (e) => e.x === 2 && e.y === 1 && e.glyph === "*",
      );
      expect(herbEntities).toHaveLength(0);
    });

    it("fromSaveData restores log entries", () => {
      const engine = createEngine();
      engine.execute({ type: "MoveEast" });

      const save = engine.createSaveData();

      const restored = GameplayEngine.fromSaveData(save, {
        resolveZone: (zoneId) =>
          zoneId === "movement_test" ? loadZone(zoneData) : undefined,
      });

      const logMessages = restored.getSnapshot().log.map((e) => e.message);
      expect(logMessages).toContain("Entered Movement Test.");
      expect(logMessages).toContain("Moved east to (2, 1).");
    });

    it("fromSaveData does not treat loading as a fresh zone entry", () => {
      const mapWithEntryDialogue = loadZone({
        ...zoneData,
        entryDialogue: [
          { speaker: "Narrator", text: "This should not replay.", pitch: 1 },
        ],
      });
      const engine = new GameplayEngine(mapWithEntryDialogue);
      const save = engine.createSaveData();
      delete save.seenZoneEntryEventIds;

      const restored = GameplayEngine.fromSaveData(save, {
        resolveZone: (zoneId) =>
          zoneId === "movement_test" ? mapWithEntryDialogue : undefined,
      });

      expect(restored.getSnapshot().entryDialogue).toEqual([]);
      expect(restored.createSaveData().seenZoneEntryEventIds).toEqual([
        "zone_entry:movement_test",
      ]);
    });

    it("fromSaveData cancels unavailable saved quests and emits a notice", () => {
      const engine = createEngine();
      const save = engine.createSaveData();
      save.activeQuests = ["lost_notebook", "missing_active_quest"];
      save.completedQuests = ["missing_completed_quest"];

      const restored = GameplayEngine.fromSaveData(save, {
        resolveZone: (zoneId) =>
          zoneId === "movement_test" ? loadZone(zoneData) : undefined,
      });

      const snapshot = restored.getSnapshot();
      expect(snapshot.activeQuests.map((quest) => quest.questId)).toEqual([
        "lost_notebook",
      ]);
      expect(snapshot.completedQuests).toEqual([]);
      expect(restored.consumeNotices()).toEqual([
        {
          title: "Quest Cancelled",
          message:
            "The saved quest data referenced unavailable quest ids and they were cancelled: missing_active_quest, missing_completed_quest.",
        },
      ]);
    });

    it("save roundtrip through fromSaveData produces equivalent snapshot data", () => {
      const engine = createEngine();
      engine.execute({ type: "MoveEast" });
      engine.execute({ type: "MoveSouth" });

      const original = engine.getSnapshot();
      const save = engine.createSaveData();

      const restored = GameplayEngine.fromSaveData(save, {
        resolveZone: (zoneId) =>
          zoneId === "movement_test" ? loadZone(zoneData) : undefined,
      });

      const restoredSnap = restored.getSnapshot();

      expect(restoredSnap.tick).toBe(original.tick);
      expect(restoredSnap.worldTime).toEqual(original.worldTime);
      expect(restoredSnap.zoneId).toBe(original.zoneId);
      expect(restoredSnap.playerX).toBe(original.playerX);
      expect(restoredSnap.playerY).toBe(original.playerY);
      expect(restoredSnap.playerFacing).toBe(original.playerFacing);
      expect(restoredSnap.stats.resources.energy).toBe(
        original.stats.resources.energy,
      );
      expect(restoredSnap.stats.resources.maxEnergy).toBe(
        original.stats.resources.maxEnergy,
      );
      expect(restoredSnap.stats).toEqual(original.stats);
      expect(restoredSnap.inventory.items).toEqual(original.inventory.items);
      expect(restoredSnap.npcStates).toEqual(original.npcStates);
      expect(restoredSnap.log.length).toBe(original.log.length);
    });

    it("fromSaveData throws when the saved zone is not available", () => {
      const engine = createEngine();
      const save = engine.createSaveData();

      expect(() =>
        GameplayEngine.fromSaveData(save, {
          resolveZone: () => undefined,
        }),
      ).toThrow("not available");
    });
  });
});
