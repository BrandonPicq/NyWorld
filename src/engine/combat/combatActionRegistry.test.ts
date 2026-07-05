import { describe, expect, it } from "vitest";
import strikeData from "../../content/combat-actions/strike.json";
import {
  getAllCombatActionDefs,
  getCombatActionDef,
  hasCombatActionDef,
  validateCombatActionDef,
  validateCombatActionRegistry,
} from "./combatActionRegistry";

const CORE_COMBAT_ACTION_IDS = [
  "strike",
  "cast",
  "guard",
  "focus",
  "flee",
  "use_item",
] as const;

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

describe("combat action tuning", () => {
  it("exposes authored tuning values", () => {
    expect(getCombatActionDef("strike").tuning).toEqual({ spGain: 5 });
    expect(getCombatActionDef("guard").tuning).toEqual({
      spGain: 10,
      incomingDamageMultiplier: 0.5,
    });
    expect(getCombatActionDef("focus").tuning).toEqual({
      spGain: 5,
      damageBoostMultiplier: 1.5,
    });
    expect(getCombatActionDef("cast").tuning).toEqual({ mpCost: 10 });
    expect(getCombatActionDef("unknown_action").tuning).toBeUndefined();
  });

  it("validates tuning fields", () => {
    const diagnostics = validateCombatActionDef({
      ...strikeData,
      tuning: { spGain: 0, mpCost: 2.5, damageBoostMultiplier: -1 },
    });

    expect(diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: "tuning.spGain",
          message:
            'Combat action definition "strike" has invalid tuning.spGain. Expected a positive integer.',
        }),
        expect.objectContaining({ path: "tuning.mpCost" }),
        expect.objectContaining({
          path: "tuning.damageBoostMultiplier",
          message:
            'Combat action definition "strike" has invalid tuning.damageBoostMultiplier. Expected a positive number.',
        }),
      ]),
    );
    expect(diagnostics).toHaveLength(3);
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
  it("loads the core combat action definitions in authored display order", () => {
    const defs = getAllCombatActionDefs();
    const ids = defs.map((def) => def.actionId);
    const orders = defs.map((def) => def.order);

    expect(ids).toEqual(expect.arrayContaining([...CORE_COMBAT_ACTION_IDS]));
    expect(orders).toEqual([...orders].sort((a, b) => a - b));

    for (let i = 1; i < CORE_COMBAT_ACTION_IDS.length; i++) {
      expect(ids.indexOf(CORE_COMBAT_ACTION_IDS[i - 1])).toBeLessThan(
        ids.indexOf(CORE_COMBAT_ACTION_IDS[i]),
      );
    }
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
