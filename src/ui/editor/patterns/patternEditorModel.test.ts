import { describe, expect, it } from "vitest";
import type { PatternDef } from "../../../engine";
import {
  createDefaultPatternDef,
  createPatternDraftValidationContext,
  isValidNewPatternId,
  listPatternEntries,
  removePatternDef,
  updatePatternDef,
  upsertPatternDef,
} from "./patternEditorModel";

function pattern(patternId: string): PatternDef {
  return { ...createDefaultPatternDef(patternId) };
}

describe("patternEditorModel", () => {
  it("validates new pattern ids as unique lowercase slugs", () => {
    const existing = [pattern("fireball")];
    expect(isValidNewPatternId("frost_lance", existing)).toBe(true);
    expect(isValidNewPatternId("fireball", existing)).toBe(false);
    expect(isValidNewPatternId("Frost Lance", existing)).toBe(false);
    expect(isValidNewPatternId("", existing)).toBe(false);
  });

  it("upserts, updates, and removes patterns keyed by id", () => {
    let patterns = upsertPatternDef([], pattern("crosscut"));
    patterns = upsertPatternDef(patterns, pattern("fireball"));
    expect(listPatternEntries(patterns).map((entry) => entry.id)).toEqual([
      "crosscut",
      "fireball",
    ]);

    patterns = updatePatternDef(patterns, "fireball", (current) => ({
      ...current,
      mpCost: 99,
    }));
    expect(patterns.find((p) => p.patternId === "fireball")?.mpCost).toBe(99);

    patterns = removePatternDef(patterns, "crosscut");
    expect(patterns.map((p) => p.patternId)).toEqual(["fireball"]);
  });

  it("rebuilds the validation context id set from the draft", () => {
    const baseContext = {
      itemIds: new Set<string>(),
      npcIds: new Set<string>(),
      dialogueIds: new Set<string>(),
      enemyIds: new Set<string>(),
      questIds: new Set<string>(),
      combatActionIds: new Set<string>(),
      classIds: new Set<string>(),
      raceIds: new Set<string>(),
      tileDefs: new Map(),
      zones: new Map(),
    };
    const context = createPatternDraftValidationContext(baseContext, [
      pattern("fireball"),
      pattern("crosscut"),
    ]);
    expect([...(context.qtePatternIds ?? [])].sort()).toEqual([
      "crosscut",
      "fireball",
    ]);
  });
});
