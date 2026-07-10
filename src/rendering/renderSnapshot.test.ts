import { describe, expect, it } from "vitest";
import {
  createInitialPlayerProgression,
  createInitialStats,
  deriveLayeredStats,
  getClassDef,
  getRaceDef,
} from "../engine";
import type { GameSnapshot } from "../engine/GameplayEngine";
import {
  START_WORLD_TIME_MINUTES,
  createWorldTimeSnapshot,
} from "../engine/time/WorldCalendar";
import { createGridRenderSnapshot } from "./renderSnapshot";

const gameSnapshot: GameSnapshot = {
  log: [],
  mapHeight: 2,
  mapWidth: 2,
  playerX: 1,
  playerY: 0,
  playerFacing: "south",
  tick: 0,
  worldTime: createWorldTimeSnapshot(START_WORLD_TIME_MINUTES),
  tiles: [
    [0, 1],
    [1, 0],
  ],
  zoneId: "test_zone",
  zoneName: "Test Zone",
  stats: createInitialStats(),
  statLayers: deriveLayeredStats({
    baseStats: createInitialStats(),
    progression: createInitialPlayerProgression(),
    classDef: getClassDef("otherworlder"),
    raceDef: getRaceDef("human"),
  }),
  knownPatterns: {},
  entities: [],
  entryDialogue: [],
  inventory: {
    type: "Inventory",
    items: [],
    equipped: {},
  },
  npcStates: [],
  activeQuests: [],
  completedQuests: [],
};

describe("createGridRenderSnapshot", () => {
  it("converts engine map data into render-ready grid data", () => {
    expect(createGridRenderSnapshot(gameSnapshot)).toEqual({
      height: 2,
      player: {
        x: 1,
        y: 0,
      },
      tiles: [
        [
          { glyph: ".", role: "open" },
          { glyph: "#", role: "blocked" },
        ],
        [
          { glyph: "#", role: "blocked" },
          { glyph: ".", role: "open" },
        ],
      ],
      width: 2,
      entities: [],
    });
  });

  it("keeps explored terrain but hides entities outside current visibility", () => {
    const snapshot: GameSnapshot = {
      ...gameSnapshot,
      mapVisibility: [
        ["visible", "hidden"],
        ["explored", "visible"],
      ],
      entities: [
        { x: 0, y: 1, glyph: "!", color: "#fff" },
        { x: 1, y: 0, glyph: "K", color: "#fff" },
        { x: 1, y: 1, glyph: "N", color: "#fff" },
      ],
    };

    const render = createGridRenderSnapshot(snapshot);

    expect(render.tiles[1][0].visibility).toBe("explored");
    expect(render.tiles[0][1].visibility).toBe("hidden");
    expect(render.entities).toEqual([{ x: 1, y: 1, glyph: "N", color: "#fff" }]);
  });
});
