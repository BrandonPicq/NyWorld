import { describe, expect, it } from "vitest";
import testZoneData from "../content/zones/test_zone.json";
import testZone2Data from "../content/zones/test_zone_2.json";
import { GameplayEngine } from "./GameplayEngine";
import type { ZoneData } from "./ZoneTypes";
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

  it("exposes current zone entry dialogue in snapshots", () => {
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

  it("interacts with NPCs when player collides with their tile", () => {
    const mapWithNpc = loadZone({
      ...zoneData,
      npcs: [
        {
          npcId: "scholar",
          name: "Old Scholar",
          glyph: "S",
          color: "#ffcc00",
          x: 2,
          y: 1,
          dialogue: [
            { speaker: "Old Scholar", text: "Welcome!", pitch: 0.9 }
          ],
        }
      ]
    });
    const engine = new GameplayEngine(mapWithNpc);

    // Player starts at (1, 1). NPC is at (2, 1).
    // Let's try to move east onto (2, 1).
    const result = engine.execute({ type: "MoveEast" });

    // The execution should return success: false and the dialogue sequence!
    expect(result.success).toBe(false);
    expect(result.dialogue).toEqual([
      { speaker: "Old Scholar", text: "Welcome!", pitch: 0.9 }
    ]);

    // Position and tick should not advance
    expect(engine.getSnapshot()).toMatchObject({
      playerX: 1,
      playerY: 1,
      tick: 0,
    });

    // The action log should contain the conversation log entry
    expect(engine.getSnapshot().log.map((entry) => entry.message)).toEqual([
      "Entered Movement Test.",
      "Talked to Old Scholar.",
    ]);
  });
});
