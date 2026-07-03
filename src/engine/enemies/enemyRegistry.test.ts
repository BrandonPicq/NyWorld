import { describe, expect, it } from "vitest";
import { createNpcStats } from "../stats/npcStats";
import {
  getAllEnemyDefs,
  getEnemyDef,
  hasEnemyDef,
  isCombatEnemy,
} from "./enemyRegistry";

describe("enemyRegistry", () => {
  it("loads combat enemy definitions from content", () => {
    expect(hasEnemyDef("slime")).toBe(true);
    expect(isCombatEnemy("slime")).toBe(true);
    expect(hasEnemyDef("kobold")).toBe(true);
    expect(isCombatEnemy("kobold")).toBe(true);
    expect(isCombatEnemy("old_wizard")).toBe(false);
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

    expect(ids).toEqual(["kobold", "slime"]);
  });
});
