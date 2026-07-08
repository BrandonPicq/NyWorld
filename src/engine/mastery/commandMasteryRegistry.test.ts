import { describe, expect, it } from "vitest";
import {
  getCommandMasteryDef,
  getAllCommandMasteryDefs,
  hasCommandMasteryDef,
  validateCommandMasteryDef,
} from "./commandMasteryRegistry";

describe("Command Mastery Registry", () => {
  it("has definitions for all 8 standard commands", () => {
    const expectedCmds = [
      "strike",
      "guard",
      "cast",
      "focus",
      "flee",
      "use_item",
      "study",
      "rest",
    ];
    for (const cmd of expectedCmds) {
      expect(hasCommandMasteryDef(cmd)).toBe(true);
      const def = getCommandMasteryDef(cmd);
      expect(def.commandId).toBe(cmd);
      expect(def.cap).toBeGreaterThan(0);
      expect(def.usageRequired).toBeGreaterThan(0);
    }
  });

  it("defines a mastery per weapon archetype at cap 10 / usage 8", () => {
    for (const weaponType of ["sword", "hammer", "bow", "staff"]) {
      const commandId = `weapon_${weaponType}`;
      expect(hasCommandMasteryDef(commandId)).toBe(true);
      const def = getCommandMasteryDef(commandId);
      expect(def.commandId).toBe(commandId);
      expect(def.cap).toBe(10);
      expect(def.usageRequired).toBe(8);
      expect(def.effects).toEqual({});
      expect(def.unlocks).toEqual([]);
    }
  });

  it("returns fallback for unknown commands", () => {
    expect(hasCommandMasteryDef("non_existent")).toBe(false);
    const fallback = getCommandMasteryDef("non_existent");
    expect(fallback.commandId).toBe("unknown");
  });

  it("validates command mastery definitions correctly", () => {
    const valid = {
      commandId: "strike",
      name: "Strike",
      cap: 5,
      usageRequired: 12,
      effects: {
        damageBoost: 0.03,
      },
      unlocks: [],
    };
    expect(validateCommandMasteryDef(valid)).toEqual([]);

    const invalid = {
      commandId: "unknown_cmd",
      name: "",
      cap: -1,
      usageRequired: 0,
      effects: "not-an-object",
    };
    const diagnostics = validateCommandMasteryDef(invalid);
    expect(diagnostics.length).toBeGreaterThan(0);
  });
});
