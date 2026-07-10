import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  createRuntimeContentCatalogSnapshot,
  type CombatActionDef,
} from "../../../engine";
import {
  actionContentPath,
  actionDerivedEffects,
  addActionLine,
  groupActionsByCategory,
  listAuthoredCombatActionDefs,
  removeActionLine,
  serializeCombatActionDef,
  setActionTuning,
  toAuthoredCombatActionDef,
  updateActionLine,
} from "./actionEditorModel";

function composedAction(overrides: Partial<CombatActionDef>): CombatActionDef {
  return {
    actionId: "strike",
    name: "Strike",
    category: "offense",
    order: 1,
    summary: "Hit.",
    formula: "ATK vs DEF.",
    effects: ["Uses Agility."],
    details: ["Baseline attack."],
    ...overrides,
  };
}

function readShippedAction(actionId: string): string {
  return readFileSync(
    new URL(`../../../content/combat-actions/${actionId}.json`, import.meta.url),
    "utf8",
  );
}

describe("toAuthoredCombatActionDef", () => {
  it("strips the tuning-derived prefix, leaving authored prose", () => {
    const composed = composedAction({
      tuning: { spGain: 5 },
      effects: ["Gain 5 SP.", "Uses Agility.", "Benefits from Focus."],
    });

    expect(toAuthoredCombatActionDef(composed).effects).toEqual([
      "Uses Agility.",
      "Benefits from Focus.",
    ]);
  });

  it("leaves a tuning-less action's effects untouched", () => {
    const composed = composedAction({ effects: ["Opens the picker."] });
    expect(toAuthoredCombatActionDef(composed).effects).toEqual([
      "Opens the picker.",
    ]);
  });
});

describe("shipped combat action round-trip", () => {
  it.each(["strike", "cast", "guard", "focus", "flee", "use_item"])(
    "re-serializes the authored %s.json byte-for-byte",
    (actionId) => {
      const snapshot = createRuntimeContentCatalogSnapshot();
      const authored = listAuthoredCombatActionDefs(snapshot).find(
        (action) => action.actionId === actionId,
      );
      if (!authored) throw new Error(`missing authored ${actionId}`);
      // The endpoint owns the trailing newline; the serializer does not add it.
      expect(serializeCombatActionDef(authored) + "\n").toBe(
        readShippedAction(actionId),
      );
    },
  );
});

describe("action tuning editing", () => {
  it("sets a field and clears it, dropping tuning when it empties", () => {
    const base = composedAction({ tuning: { spGain: 5 } });

    const withMp = setActionTuning(base, "mpCost", 10);
    expect(withMp.tuning).toEqual({ spGain: 5, mpCost: 10 });

    const withoutSp = setActionTuning(withMp, "spGain", undefined);
    expect(withoutSp.tuning).toEqual({ mpCost: 10 });

    const cleared = setActionTuning(
      setActionTuning(base, "spGain", undefined),
      "mpCost",
      undefined,
    );
    expect(cleared.tuning).toBeUndefined();
  });

  it("previews the derived lines for the current tuning", () => {
    expect(actionDerivedEffects(composedAction({ tuning: { spGain: 10 } }))).toEqual(
      ["Gain 10 SP."],
    );
    expect(actionDerivedEffects(composedAction({}))).toEqual([]);
  });
});

describe("action line editing", () => {
  it("adds, updates, and removes effect lines without mutating the source", () => {
    const base = composedAction({ effects: ["A."] });

    const added = addActionLine(base, "effects");
    const updated = updateActionLine(added, "effects", 1, "B.");
    const removed = removeActionLine(updated, "effects", 0);

    expect(base.effects).toEqual(["A."]);
    expect(removed.effects).toEqual(["B."]);
  });
});

describe("actionContentPath", () => {
  it("builds the combat action JSON path from the action id", () => {
    expect(actionContentPath("guard")).toBe(
      "src/content/combat-actions/guard.json",
    );
  });
});

describe("groupActionsByCategory", () => {
  it("keeps the category order and sorts actions by menu order", () => {
    const groups = groupActionsByCategory([
      { actionId: "guard", category: "defense", order: 3 },
      { actionId: "strike", category: "offense", order: 1 },
      { actionId: "cast", category: "offense", order: 2 },
    ]);

    expect(groups.map((group) => group.category)).toEqual([
      "offense",
      "defense",
    ]);
    expect(groups[0]?.actions.map((action) => action.actionId)).toEqual([
      "strike",
      "cast",
    ]);
  });
});
