import { describe, expect, it } from "vitest";
import type { Stats } from "../components";
import type { CombatActionDef } from "./CombatActionDef";
import { summarizeCombatActionForTooltip } from "./combatActionSummary";

const attacker = makeStats({
  attack: 10,
  magicAttack: 12,
  agility: 10,
  spirit: 11,
});
const defender = makeStats({
  defense: 3,
  magicDefense: 4,
  agility: 8,
  spirit: 9,
});

describe("summarizeCombatActionForTooltip", () => {
  it("summarizes expected physical damage from combat tuning", () => {
    expect(
      summarizeCombatActionForTooltip({
        action: makeAction({ actionId: "strike", tuning: { spGain: 5 } }),
        attacker,
        defender,
      }),
    ).toEqual({
      damage: "6-10",
      cost: "None",
      attackType: "Physical",
      additionalEffectCodes: [],
    });
  });

  it("summarizes magical cost and damage separately from prose", () => {
    expect(
      summarizeCombatActionForTooltip({
        action: makeAction({ actionId: "cast", tuning: { mpCost: 10 } }),
        attacker,
        defender,
      }),
    ).toMatchObject({
      damage: "7-11",
      cost: "10 MP",
      attackType: "Magical",
    });
  });

  it("marks non-damaging actions without inventing extra effects", () => {
    expect(
      summarizeCombatActionForTooltip({
        action: makeAction({ actionId: "guard", tuning: { spGain: 10 } }),
        attacker,
        defender,
      }),
    ).toEqual({
      damage: "None",
      cost: "None",
      attackType: "None",
      additionalEffectCodes: [],
    });
  });
});

function makeAction(
  overrides: Pick<CombatActionDef, "actionId"> & Partial<CombatActionDef>,
): CombatActionDef {
  const { actionId, ...rest } = overrides;
  return {
    actionId,
    name: "Action",
    category: "offense",
    order: 1,
    summary: "Summary.",
    formula: "Formula.",
    effects: ["Long prose effect."],
    details: ["Detailed text."],
    ...rest,
  };
}

function makeStats(overrides: PartialStats): Stats {
  return {
    attributes: {
      strength: 10,
      vitality: 10,
      agility: overrides.agility ?? 10,
      intelligence: 10,
      spirit: overrides.spirit ?? 10,
      willpower: 10,
      perception: 10,
      charisma: 10,
    },
    combat: {
      attack: overrides.attack ?? 10,
      defense: overrides.defense ?? 0,
      magicAttack: overrides.magicAttack ?? 10,
      magicDefense: overrides.magicDefense ?? 0,
    },
    resources: {
      hp: 30,
      maxHp: 30,
      mp: 20,
      maxMp: 20,
      sp: 0,
      maxSp: 100,
      energy: 20,
      maxEnergy: 20,
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
    progression: {
      academicTitle: "Tester",
      academicProgress: 0,
    },
    conditions: [],
    currency: 0,
    type: "Stats",
  };
}

interface PartialStats {
  attack?: number;
  defense?: number;
  magicAttack?: number;
  magicDefense?: number;
  agility?: number;
  spirit?: number;
}
