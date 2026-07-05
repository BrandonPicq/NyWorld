import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import type {
  ContentCatalogSnapshot,
  ContentDiagnostic,
  ContentValidationContext,
  GameContentConfig,
  GameMap,
} from "../../engine";
import { buildContentReferenceGraph } from "../../engine";
import {
  buildContentBrowserGroups,
  cloneItemCatalog,
  createItemDraftSnapshot,
  createItemDraftValidationContext,
  groupDiagnosticsByContentType,
  serializeGameConfig,
} from "./editorModel";

function createSnapshot(): ContentCatalogSnapshot {
  return {
    game: {
      defaultZoneId: "zone_b",
      safeRespawn: { zoneId: "zone_b", x: 1, y: 1 },
      actions: {
        rest: { energyRestore: 15 },
        study: { energyCost: 10, academicProgressGain: 15, intelligenceGain: 1 },
      },
      newGame: {
        startingCurrency: 0,
        maxEnergy: 100,
        startingInventory: [],
        attributes: {
          strength: 1,
          vitality: 1,
          agility: 1,
          intelligence: 1,
          spirit: 1,
          willpower: 1,
          perception: 1,
          charisma: 1,
        },
        skills: {
          melee: 0,
          ranged: 0,
          guard: 0,
          evasion: 0,
          spellcasting: 0,
          focus: 0,
          athletics: 0,
          scholarship: 0,
          speech: 0,
        },
      },
    },
    zones: {
      zone_b: {
        version: "0.1",
        zoneId: "zone_b",
        name: "Zone B",
        width: 3,
        height: 3,
        playerStart: { x: 1, y: 1 },
        tiles: [[0]],
      },
      zone_a: {
        version: "0.1",
        zoneId: "zone_a",
        name: "Zone A",
        width: 3,
        height: 3,
        playerStart: { x: 1, y: 1 },
        tiles: [[0]],
      },
    },
    items: {
      ration: {
        name: "Ration",
        description: "Food.",
        category: "consumable",
        defaultQuantity: 1,
      },
    },
    npcs: [],
    npcPresence: [],
    enemies: [],
    quests: [],
    combatActions: [],
    dialogues: {},
    tiles: new Map([
      [1, { name: "wall", walkable: false, glyph: "#", color: "#666666" }],
      [0, { name: "floor", walkable: true, glyph: ".", color: "#333333" }],
    ]),
  };
}

describe("serializeGameConfig", () => {
  it("round-trips the shipped game.json byte-for-byte", () => {
    const raw = readFileSync(
      new URL("../../content/game.json", import.meta.url),
      "utf8",
    );
    const config = JSON.parse(raw) as GameContentConfig;
    // The endpoint owns the trailing newline; the serializer does not add it.
    expect(serializeGameConfig(config) + "\n").toBe(raw);
  });

  it("keeps each starting-inventory stack on a single line", () => {
    const raw = readFileSync(
      new URL("../../content/game.json", import.meta.url),
      "utf8",
    );
    const serialized = serializeGameConfig(JSON.parse(raw) as GameContentConfig);
    expect(serialized).toContain(
      '      { "itemId": "academy_notebook", "quantity": 1 },',
    );
  });
});

describe("buildContentBrowserGroups", () => {
  it("lists content families with deterministic ids", () => {
    const groups = buildContentBrowserGroups(createSnapshot());

    expect(groups.find((group) => group.type === "zone")?.entries).toEqual([
      { ref: { type: "zone", id: "zone_a" }, label: "zone_a" },
      { ref: { type: "zone", id: "zone_b" }, label: "zone_b" },
    ]);
    expect(groups.find((group) => group.type === "tile")?.entries).toEqual([
      { ref: { type: "tile", id: "0" }, label: "0" },
      { ref: { type: "tile", id: "1" }, label: "1" },
    ]);
  });
});

describe("groupDiagnosticsByContentType", () => {
  it("groups diagnostics with error and warning counts", () => {
    const diagnostics: ContentDiagnostic[] = [
      {
        severity: "warning",
        contentType: "item",
        contentId: "ration",
        path: "effects",
        message: "warn",
      },
      {
        severity: "error",
        contentType: "zone",
        contentId: "zone_a",
        path: "tiles",
        message: "error",
      },
      {
        severity: "error",
        contentType: "item",
        contentId: "ration",
        path: "name",
        message: "error",
      },
    ];

    expect(groupDiagnosticsByContentType(diagnostics)).toEqual([
      {
        contentType: "item",
        errorCount: 1,
        warningCount: 1,
        diagnostics: [
          expect.objectContaining({ severity: "error", path: "name" }),
          expect.objectContaining({ severity: "warning", path: "effects" }),
        ],
      },
      {
        contentType: "zone",
        errorCount: 1,
        warningCount: 0,
        diagnostics: [expect.objectContaining({ path: "tiles" })],
      },
    ]);
  });
});

describe("item draft helpers", () => {
  it("creates detached item snapshots and injected item id contexts", () => {
    const snapshot = createSnapshot();
    const draftItems = cloneItemCatalog(snapshot.items);
    draftItems.ration.effects = { energyRestore: 5 };

    const draftSnapshot = createItemDraftSnapshot(snapshot, draftItems);
    draftSnapshot.items.ration.effects!.energyRestore = 9;

    expect(draftItems.ration.effects?.energyRestore).toBe(5);

    const context = createValidationContext(["ration"]);
    const draftContext = createItemDraftValidationContext(context, {
      renamed_ration: draftItems.ration,
    });

    expect([...draftContext.itemIds]).toEqual(["renamed_ration"]);
    expect([...context.itemIds]).toEqual(["ration"]);
  });

  it("uses draft item ids when checking dangling references", () => {
    const snapshot = createSnapshot();
    snapshot.game.newGame.startingInventory = [
      { itemId: "ration", quantity: 1 },
    ];

    const draftSnapshot = createItemDraftSnapshot(snapshot, {});
    const draftContext = createItemDraftValidationContext(
      createValidationContext(["ration"]),
      {},
    );

    const danglingReferences =
      buildContentReferenceGraph(draftSnapshot).getDanglingReferences(
        draftContext,
      );

    expect(danglingReferences).toContainEqual(
      expect.objectContaining({
        from: { type: "game", id: "game" },
        to: { type: "item", id: "ration" },
        path: "newGame.startingInventory[0].itemId",
      }),
    );
  });
});

function createValidationContext(itemIds: string[]): ContentValidationContext {
  return {
    itemIds: new Set(itemIds),
    npcIds: new Set(),
    dialogueIds: new Set(),
    enemyIds: new Set(),
    questIds: new Set(),
    combatActionIds: new Set(),
    tileDefs: new Map([
      [0, { name: "floor", walkable: true, glyph: ".", color: "#333333" }],
    ]),
    zones: new Map([["zone_b", {} as GameMap]]),
  };
}
