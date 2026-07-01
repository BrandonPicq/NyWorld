import { describe, expect, it } from "vitest";
import type { GameSnapshot } from "../engine/GameplayEngine";
import { createGridRenderSnapshot } from "./renderSnapshot";

const gameSnapshot: GameSnapshot = {
  log: [],
  mapHeight: 2,
  mapWidth: 2,
  playerX: 1,
  playerY: 0,
  tick: 0,
  tiles: [
    [0, 1],
    [1, 0],
  ],
  zoneId: "test_zone",
  zoneName: "Test Zone",
  stats: {
    type: "Stats",
    energy: 100,
    maxEnergy: 100,
    currency: 1550,
    attributes: { strength: 10, intelligence: 10, charisma: 10 },
    academicTitle: "Novice Scribe",
    academicProgress: 0,
  },
  entities: [],
  entryDialogue: [],
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
