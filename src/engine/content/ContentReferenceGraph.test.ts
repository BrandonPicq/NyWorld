import { describe, expect, it } from "vitest";

import {
  buildContentReferenceGraph,
  type ContentCatalogSnapshot,
} from "./ContentReferenceGraph";
import { createRuntimeContentCatalogSnapshot } from "./runtimeContentCatalog";
import { createRuntimeContentValidationContext } from "./runtimeValidationContext";
import type { ContentValidationContext } from "./ContentValidationContext";
import { GameMap } from "../GameMap";

const smallZone = {
  version: "0.1",
  zoneId: "small_zone",
  name: "Small Zone",
  width: 3,
  height: 3,
  playerStart: { x: 1, y: 1 },
  tiles: [
    [1, 1, 1],
    [1, 0, 0],
    [1, 1, 1],
  ],
  npcs: [{ npcId: "hero", dialogueId: "hero.greeting", x: 2, y: 1 }],
  items: [{ itemId: "trinket", x: 2, y: 1, quantity: 1 }],
};

function createSyntheticSnapshot(): ContentCatalogSnapshot {
  return {
    game: {
      defaultZoneId: "small_zone",
      safeRespawn: { zoneId: "small_zone", x: 1, y: 1 },
      actions: {
        rest: { energyRestore: 15 },
        study: { energyCost: 10, academicProgressGain: 15, intelligenceGain: 1 },
      },
      newGame: {
        startingCurrency: 100,
        maxEnergy: 100,
        startingInventory: [{ itemId: "trinket", quantity: 1 }],
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
    },
    zones: { small_zone: smallZone },
    items: {
      trinket: {
        name: "Trinket",
        description: "A small keepsake.",
        category: "misc",
        defaultQuantity: 1,
      },
    },
    npcs: [
      {
        npcId: "hero",
        name: "Hero",
        race: "human",
        classId: "wanderer",
        raceId: "human",
        level: 2,
        defaultDialogueId: "hero.greeting",
      },
    ],
    npcPresence: [
      {
        npcId: "hero",
        schedule: [
          { time: "08:00", zoneId: "missing_zone", x: 1, y: 1 },
        ],
      },
    ],
    enemies: [],
    quests: [],
    combatActions: [],
    classes: [
      {
        classId: "wanderer",
        name: "Wanderer",
        description: "A test class.",
        equipmentPermissions: {
          allowedWeaponTypes: ["sword"],
          allowedArmorSlots: ["body"],
        },
        growthCycle: [{ level: 2, attributes: { strength: 1 } }],
      },
    ],
    races: [
      {
        raceId: "human",
        name: "Human",
        description: "A test race.",
        growthMultipliers: { strength: 1 },
      },
    ],
    dialogues: {
      "hero.greeting": [{ speaker: "Hero", text: "Hello.", pitch: 1 }],
    },
    dialogueFiles: {
      hero: {
        "hero.greeting": [{ speaker: "Hero", text: "Hello.", pitch: 1 }],
      },
    },
    tiles: new Map([
      [0, { name: "floor", walkable: true, glyph: ".", color: "#333333" }],
      [1, { name: "wall", walkable: false, glyph: "#", color: "#666666" }],
    ]),
  };
}

function createSyntheticContext(
  snapshot: ContentCatalogSnapshot,
): ContentValidationContext {
  return {
    itemIds: new Set(Object.keys(snapshot.items)),
    npcIds: new Set(snapshot.npcs.map((npc) => npc.npcId)),
    dialogueIds: new Set(Object.keys(snapshot.dialogues)),
    enemyIds: new Set(snapshot.enemies.map((enemy) => enemy.npcId)),
    questIds: new Set(snapshot.quests.map((quest) => quest.questId)),
    combatActionIds: new Set(
      snapshot.combatActions.map((action) => action.actionId),
    ),
    classIds: new Set(snapshot.classes.map((classDef) => classDef.classId)),
    raceIds: new Set(snapshot.races.map((race) => race.raceId)),
    tileDefs: snapshot.tiles,
    zones: new Map(
      Object.values(snapshot.zones).map((zone) => [
        zone.zoneId,
        new GameMap(zone),
      ]),
    ),
  };
}

describe("buildContentReferenceGraph", () => {
  it("answers where an id is used", () => {
    const graph = buildContentReferenceGraph(createSyntheticSnapshot());

    const dialogueUsages = graph.getReferencesTo({
      type: "dialogue",
      id: "hero.greeting",
    });

    expect(dialogueUsages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          from: { type: "zone", id: "small_zone" },
          path: "npcs[0].dialogueId",
        }),
        expect.objectContaining({
          from: { type: "npc", id: "hero" },
          path: "defaultDialogueId",
        }),
      ]),
    );
    expect(dialogueUsages).toHaveLength(2);
  });

  it("tracks NPC class and race references", () => {
    const graph = buildContentReferenceGraph(createSyntheticSnapshot());

    expect(
      graph.getReferencesTo({ type: "class", id: "wanderer" }),
    ).toEqual([
      expect.objectContaining({
        from: { type: "npc", id: "hero" },
        path: "classId",
      }),
    ]);
    expect(graph.getReferencesTo({ type: "race", id: "human" })).toEqual([
      expect.objectContaining({
        from: { type: "npc", id: "hero" },
        path: "raceId",
      }),
    ]);
  });

  it("lists outgoing references for one content piece", () => {
    const graph = buildContentReferenceGraph(createSyntheticSnapshot());

    const zoneRefs = graph.getReferencesFrom({
      type: "zone",
      id: "small_zone",
    });

    expect(zoneRefs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ to: { type: "tile", id: "0" } }),
        expect.objectContaining({ to: { type: "tile", id: "1" } }),
        expect.objectContaining({ to: { type: "npc", id: "hero" } }),
        expect.objectContaining({ to: { type: "item", id: "trinket" } }),
      ]),
    );
  });

  it("detects dangling references with the full context", () => {
    const snapshot = createSyntheticSnapshot();
    const graph = buildContentReferenceGraph(snapshot);

    const dangling = graph.getDanglingReferences(
      createSyntheticContext(snapshot),
    );

    expect(dangling).toEqual([
      expect.objectContaining({
        from: { type: "npc-presence", id: "hero" },
        to: { type: "zone", id: "missing_zone" },
        path: "schedule[0].zoneId",
      }),
    ]);
  });

  it("reports rename impact including save persistence", () => {
    const snapshot = createSyntheticSnapshot();
    const graph = buildContentReferenceGraph(snapshot);

    const itemImpact = graph.getRenameImpact({ type: "item", id: "trinket" });
    expect(itemImpact.appearsInSaves).toBe(true);
    expect(itemImpact.references).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          from: { type: "game", id: "game" },
          path: "newGame.startingInventory[0].itemId",
        }),
        expect.objectContaining({
          from: { type: "zone", id: "small_zone" },
          path: "items[0].itemId",
        }),
      ]),
    );

    const tileImpact = graph.getRenameImpact({ type: "tile", id: "0" });
    expect(tileImpact.appearsInSaves).toBe(false);
  });
});

describe("runtime content catalog", () => {
  it("finds shipped usages of a dialogue id", () => {
    const graph = buildContentReferenceGraph(createRuntimeContentCatalogSnapshot());
    const dialogueRef = graph.references.find(
      (reference) => reference.to.type === "dialogue",
    )?.to;

    expect(dialogueRef).toBeDefined();
    const usages = graph.getReferencesTo(
      dialogueRef ?? { type: "dialogue", id: "missing" },
    );

    expect(usages.length).toBeGreaterThan(0);
  });

  it("has no dangling references in shipped content", () => {
    const graph = buildContentReferenceGraph(
      createRuntimeContentCatalogSnapshot(),
    );

    expect(
      graph.getDanglingReferences(createRuntimeContentValidationContext()),
    ).toEqual([]);
  });
});
