import { describe, expect, it } from "vitest";
import {
  getAllCombatActionDefs,
  getCombatActionDef,
  hasCombatActionDef,
} from "./combatActionRegistry";

describe("combatActionRegistry", () => {
  it("loads the core combat action definitions in display order", () => {
    expect(getAllCombatActionDefs().map((def) => def.actionId)).toEqual([
      "strike",
      "cast",
      "guard",
      "focus",
      "flee",
      "use_item",
    ]);
  });

  it("exposes concise and detailed help for every action", () => {
    for (const def of getAllCombatActionDefs()) {
      expect(def.name).not.toHaveLength(0);
      expect(def.summary).not.toHaveLength(0);
      expect(def.formula).not.toHaveLength(0);
      expect(def.effects.length).toBeGreaterThan(0);
      expect(def.details.length).toBeGreaterThan(0);
    }
  });

  it("returns cloned action metadata", () => {
    const def = getCombatActionDef("strike");
    def.effects[0] = "mutated";

    expect(getCombatActionDef("strike").effects[0]).not.toBe("mutated");
  });

  it("checks action availability by id", () => {
    expect(hasCombatActionDef("guard")).toBe(true);
    expect(hasCombatActionDef("unknown_action")).toBe(false);
  });
});
