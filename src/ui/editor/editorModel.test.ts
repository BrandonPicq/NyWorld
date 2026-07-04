import { describe, expect, it } from "vitest";

import type { ContentCatalogSnapshot, ContentDiagnostic } from "../../engine";
import {
  buildContentBrowserGroups,
  groupDiagnosticsByContentType,
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
