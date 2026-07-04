import { describe, expect, it } from "vitest";
import strikeData from "../../content/combat-actions/strike.json";
import {
  getAllCombatActionDefs,
  getCombatActionDef,
  hasCombatActionDef,
  validateCombatActionDef,
  validateCombatActionRegistry,
} from "./combatActionRegistry";

describe("validateCombatActionDef", () => {
  it("accepts the shipped strike definition", () => {
    expect(validateCombatActionDef(strikeData)).toEqual([]);
  });

  it("accumulates several errors with precise paths", () => {
    const diagnostics = validateCombatActionDef({
      actionId: "dance",
      name: "",
      category: "party",
      order: -1,
      summary: "A move.",
      formula: "None.",
      effects: [],
      details: ["Fine detail.", ""],
    });

    expect(diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          contentType: "combat-action",
          path: "actionId",
          message:
            "Combat action definition has invalid or missing actionId.",
        }),
        expect.objectContaining({ path: "name" }),
        expect.objectContaining({ path: "category" }),
        expect.objectContaining({ path: "order" }),
        expect.objectContaining({ path: "effects" }),
        expect.objectContaining({ path: "details[1]" }),
      ]),
    );
    expect(diagnostics).toHaveLength(6);
  });
});

describe("validateCombatActionRegistry", () => {
  it("reports duplicate action ids and shared menu orders", () => {
    const otherAction = { ...strikeData, actionId: "cast" };

    const diagnostics = validateCombatActionRegistry([
      strikeData,
      strikeData,
      otherAction,
    ]);

    expect(diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          severity: "error",
          contentId: "strike",
          message: 'Duplicate combat action definition "strike".',
        }),
        expect.objectContaining({
          severity: "warning",
          contentId: "cast",
          path: "order",
          message: 'Combat action "cast" shares menu order 1 with "strike".',
        }),
      ]),
    );
  });
});

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
