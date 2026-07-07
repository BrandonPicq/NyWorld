import { afterEach, describe, expect, it } from "vitest";
import slimeData from "../../content/enemies/slime.json";
import { createNpcStats } from "../stats/npcStats";
import type { EnemyDef } from "./EnemyDef";
import {
  clearEnemyContentOverlay,
  getAllEnemyDefs,
  getEnemyDef,
  hasEnemyDef,
  installEnemyContentOverlay,
  isCombatEnemy,
  validateEnemyDef,
  validateEnemyRegistry,
} from "./enemyRegistry";

const authoredEnemies = import.meta.glob<EnemyDef>(
  "../../content/enemies/*.json",
  {
    eager: true,
    import: "default",
  },
);
const authoredEnemyIds = Object.values(authoredEnemies)
  .map((enemy) => enemy.npcId)
  .sort((a, b) => a.localeCompare(b));

const draftEnemyContext = {
  npcIds: new Set(["slime", "draft_beast"]),
  itemIds: new Set(["slime_remains", "draft_fang"]),
};

describe("validateEnemyDef", () => {
  it("accepts the shipped slime definition against an injected context", () => {
    expect(validateEnemyDef(slimeData, draftEnemyContext)).toEqual([]);
  });

  it("accumulates stat and loot errors with precise paths", () => {
    const brokenEnemy = {
      npcId: "phantom",
      combatable: "yes",
      stats: {
        ...slimeData.stats,
        combat: { attack: 3, magicAttack: 1, defense: 1 },
        progression: { academicTitle: "", academicProgress: 0 },
      },
      loot: [{ itemId: "missing_item", quantity: 0 }],
    };

    const diagnostics = validateEnemyDef(brokenEnemy, draftEnemyContext);

    expect(diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          contentType: "enemy",
          contentId: "phantom",
          path: "npcId",
          message: 'Enemy definition references unknown npcId "phantom".',
        }),
        expect.objectContaining({ path: "combatable" }),
        expect.objectContaining({ path: "stats.combat.magicDefense" }),
        expect.objectContaining({ path: "stats.progression.academicTitle" }),
        expect.objectContaining({
          path: "loot[0].itemId",
          message:
            'Enemy definition "phantom" loot entry 0 references unknown itemId "missing_item".',
        }),
        expect.objectContaining({ path: "loot[0].quantity" }),
      ]),
    );
    expect(diagnostics).toHaveLength(6);
  });
});

describe("validateEnemyRegistry", () => {
  it("reports duplicate enemy ids", () => {
    const diagnostics = validateEnemyRegistry(
      [slimeData, slimeData],
      draftEnemyContext,
    );

    expect(diagnostics).toEqual([
      expect.objectContaining({
        contentId: "slime",
        path: "npcId",
        message: 'Duplicate enemy definition "slime".',
      }),
    ]);
  });
});

describe("enemyRegistry", () => {
  afterEach(() => {
    clearEnemyContentOverlay();
  });

  it("loads combat enemy definitions from content", () => {
    expect(hasEnemyDef("slime")).toBe(true);
    expect(isCombatEnemy("slime")).toBe(true);
    expect(hasEnemyDef("goblin")).toBe(true);
    expect(isCombatEnemy("goblin")).toBe(true);
    expect(hasEnemyDef("kobold")).toBe(true);
    expect(isCombatEnemy("kobold")).toBe(true);
    expect(isCombatEnemy("old_wizard")).toBe(false);
  });

  it("exposes goblin stats and loot between slime and kobold content", () => {
    const goblin = getEnemyDef("goblin");

    expect(goblin).toMatchObject({
      npcId: "goblin",
      combatable: true,
      stats: {
        resources: { hp: 27, maxHp: 27 },
        combat: { attack: 7, defense: 4 },
      },
      loot: [{ itemId: "goblin_ear", quantity: 1 }],
    });
  });

  it("exposes kobold stats and loot from content", () => {
    const kobold = getEnemyDef("kobold");

    expect(kobold).toMatchObject({
      npcId: "kobold",
      combatable: true,
      stats: {
        resources: { hp: 35, maxHp: 35 },
        attributes: { agility: 15 },
        combat: { attack: 12, defense: 8 },
      },
      loot: [{ itemId: "kobold_remains", quantity: 1 }],
    });
  });

  it("protects enemy content from external mutations", () => {
    const firstRead = getEnemyDef("slime")!;
    firstRead.stats.resources.hp = 999;
    firstRead.loot.push({ itemId: "travel_ration", quantity: 99 });

    expect(getEnemyDef("slime")).toMatchObject({
      stats: { resources: { hp: 20 } },
      loot: [{ itemId: "slime_remains", quantity: 1 }],
    });
  });

  it("creates detached combat stats from enemy content", () => {
    const stats = createNpcStats("kobold");
    stats.resources.hp = 1;

    expect(stats).toMatchObject({
      type: "Stats",
      currency: 0,
      resources: { hp: 1, maxHp: 35 },
      progression: { academicTitle: "Fierce Kobold" },
    });
    expect(createNpcStats("kobold").resources.hp).toBe(35);
  });

  it("throws when combat stats are requested for a NPC without enemy content", () => {
    expect(() => createNpcStats("old_wizard")).toThrow(
      'Cannot create combat stats for unknown enemy "old_wizard".',
    );
  });

  it("returns every enemy definition as detached content", () => {
    const defs = getAllEnemyDefs();
    const ids = defs.map((def) => def.npcId);

    expect([...ids].sort((a, b) => a.localeCompare(b))).toEqual(
      authoredEnemyIds,
    );
    expect(ids).toEqual(expect.arrayContaining(["goblin", "kobold", "slime"]));

    defs[0].loot.push({ itemId: "mutated", quantity: 99 });
    expect(getEnemyDef(defs[0].npcId)?.loot).not.toContainEqual({
      itemId: "mutated",
      quantity: 99,
    });
  });

  it("serves detached draft enemy definitions from a dev content overlay", () => {
    const draft = {
      ...slimeData,
      combatable: false,
      loot: [{ ...slimeData.loot[0], quantity: 3 }],
    };

    installEnemyContentOverlay([draft]);

    expect(getAllEnemyDefs()).toEqual([draft]);
    expect(hasEnemyDef("slime")).toBe(true);
    expect(isCombatEnemy("slime")).toBe(false);
    expect(getEnemyDef("slime")).toEqual(draft);

    const firstRead = getEnemyDef("slime")!;
    firstRead.loot[0].quantity = 99;
    expect(getEnemyDef("slime")).toEqual(draft);

    expect(getEnemyDef("missing_overlay_enemy")).toBeUndefined();

    clearEnemyContentOverlay();
    expect(getEnemyDef("slime")).toEqual(slimeData);
  });
});
