import { describe, expect, it } from "vitest";
import qtePatternData from "../../content/qte-patterns/fireball.json";
import {
  getAllQtePatternDefs,
  getAllQtePatternIds,
  getQtePatternDef,
  hasQtePatternDef,
  validateQtePatternDef,
  validateQtePatternRegistry,
} from "./qtePatternRegistry";

const context = { qtePatternIds: new Set(["fireball", "crosscut", "pyrosphere"]) };

describe("qtePatternRegistry", () => {
  it("loads the shipped patterns", () => {
    const ids = getAllQtePatternIds();
    expect(ids).toContain("fireball");
    expect(ids).toContain("pyrosphere");
    expect(ids).toContain("crosscut");
    expect(getAllQtePatternDefs().length).toBe(ids.length);
  });

  it("returns detached copies and undefined for unknown ids", () => {
    const def = getQtePatternDef("fireball")!;
    expect(def.kind).toBe("magical");
    def.inputs.push("up");
    expect(getQtePatternDef("fireball")!.inputs).not.toContain(def.inputs.length);
    expect(getQtePatternDef("does_not_exist")).toBeUndefined();
    expect(hasQtePatternDef("does_not_exist")).toBe(false);
  });

  it("accepts the shipped fireball definition", () => {
    expect(validateQtePatternDef(qtePatternData, context)).toEqual([]);
  });

  it("audits the shipped patterns with no errors", () => {
    expect(validateQtePatternRegistry(getAllQtePatternDefs())).toEqual([]);
  });

  it("rejects an out-of-range input sequence", () => {
    const diagnostics = validateQtePatternDef(
      {
        patternId: "too_short",
        name: "Too Short",
        description: "Not enough inputs.",
        kind: "magical",
        inputs: ["up", "down"],
        timeLimitMs: 3000,
        mpCost: 5,
        damageMultiplier: 1.2,
        requiredPlayerLevel: 1,
        requiredIntelligence: 5,
      },
      context,
    );
    expect(diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ contentId: "too_short", path: "inputs" }),
      ]),
    );
  });

  it("rejects an invalid arrow input and unknown weapon type", () => {
    const diagnostics = validateQtePatternDef(
      {
        patternId: "bad_pattern",
        name: "Bad Pattern",
        description: "Bad input and weapon type.",
        kind: "physical",
        inputs: ["up", "left", "spin", "down", "up"],
        timeLimitMs: 3000,
        mpCost: 5,
        damageMultiplier: 1.2,
        requiredPlayerLevel: 1,
        requiredIntelligence: 5,
        requiredWeaponTypes: ["trident"],
      },
      context,
    );
    expect(diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ contentId: "bad_pattern", path: "inputs[2]" }),
        expect.objectContaining({
          contentId: "bad_pattern",
          path: "requiredWeaponTypes[0]",
        }),
      ]),
    );
  });

  it("rejects an evolvesFrom pointing at an unknown pattern", () => {
    const diagnostics = validateQtePatternRegistry([
      {
        patternId: "evolved",
        name: "Evolved",
        description: "Evolves from nothing.",
        kind: "magical",
        inputs: ["up", "down", "left", "right"],
        timeLimitMs: 3000,
        mpCost: 5,
        damageMultiplier: 1.2,
        requiredPlayerLevel: 1,
        requiredIntelligence: 5,
        evolvesFrom: { patternId: "ghost", usageRequired: 5 },
      },
    ]);
    expect(diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          contentId: "evolved",
          path: "evolvesFrom.patternId",
        }),
      ]),
    );
  });
});
