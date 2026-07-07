import { describe, expect, it } from "vitest";
import {
  START_WORLD_TIME_MINUTES,
  createInitialPlayerProgression,
  createInitialStats,
  createWorldTimeSnapshot,
  deriveLayeredStats,
  getClassDef,
  getRaceDef,
  type GameSnapshot,
} from "../../engine";
import {
  createInteractionCommand,
  getInteractionTargets,
} from "./interactionTargets";

const baseSnapshot: GameSnapshot = {
  tick: 0,
  worldTime: createWorldTimeSnapshot(START_WORLD_TIME_MINUTES),
  zoneId: "test_zone",
  zoneName: "Test Zone",
  mapWidth: 5,
  mapHeight: 5,
  playerX: 2,
  playerY: 2,
  playerFacing: "east",
  tiles: [
    [0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0],
  ],
  log: [],
  stats: createInitialStats(),
  statLayers: deriveLayeredStats({
    baseStats: createInitialStats(),
    progression: createInitialPlayerProgression(),
    classDef: getClassDef("otherworlder"),
    raceDef: getRaceDef("human"),
  }),
  entities: [
    {
      x: 3,
      y: 2,
      glyph: "S",
      color: "#ffcc00",
      npcId: "scholar",
      name: "Old Scholar",
    },
    {
      x: 2,
      y: 3,
      glyph: "G",
      color: "#ff0000",
      npcId: "sage",
      name: "Old Sage",
    },
    {
      x: 1,
      y: 2,
      glyph: "?",
      color: "#ffffff",
    },
  ],
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

describe("interactionTargets", () => {
  it("returns nearby NPC targets in engine direction order", () => {
    expect(
      getInteractionTargets(baseSnapshot, {
        smartInteract: true,
        interactionTargetingMode: "nearby",
      }),
    ).toEqual([
      {
        direction: "east",
        id: "npc:scholar",
        kind: "npc",
        label: "Talk to Old Scholar",
        npcId: "scholar",
        x: 3,
        y: 2,
      },
      {
        direction: "south",
        id: "npc:sage",
        kind: "npc",
        label: "Talk to Old Sage",
        npcId: "sage",
        x: 2,
        y: 3,
      },
    ]);
  });

  it("returns only targets in the player facing direction", () => {
    expect(
      getInteractionTargets(baseSnapshot, {
        smartInteract: false,
        interactionTargetingMode: "facing",
      }).map((target) => target.id),
    ).toEqual(["npc:scholar"]);
  });

  it("creates explicit engine commands for selected targets", () => {
    const [target] = getInteractionTargets(baseSnapshot, {
      smartInteract: true,
      interactionTargetingMode: "nearby",
    });

    expect(createInteractionCommand(target)).toEqual({
      type: "Interact",
      targetDirection: "east",
      targetNpcId: "scholar",
    });
  });
});
