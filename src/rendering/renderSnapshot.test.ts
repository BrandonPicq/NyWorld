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
  entities: [],
  entryDialogue: [],
  inventory: {
    type: "Inventory",
    items: [],
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
});
