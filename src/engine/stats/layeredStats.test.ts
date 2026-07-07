import { describe, expect, it } from "vitest";

import type { ClassDef } from "../classes/ClassDef";
import type { RaceDef } from "../races/RaceDef";
import { createInitialStats } from "./characterStats";
import {
  applyLayeredStats,
  createInitialPlayerProgression,
  deriveLayeredStats,
} from "./layeredStats";

const human: RaceDef = {
  raceId: "human",
  name: "Human",
  description: "Neutral.",
  growthMultipliers: {},
};

const elf: RaceDef = {
  raceId: "elf",
  name: "Elf",
  description: "Agile.",
  growthMultipliers: {
    agility: 1.15,
    intelligence: 1.1,
    vitality: 0.95,
  },
};

const otherworlder: ClassDef = {
  classId: "otherworlder",
  name: "Otherworlder",
  description: "General.",
  equipmentPermissions: {
    allowedWeaponTypes: ["sword", "hammer", "bow", "staff"],
    allowedArmorSlots: ["offHand", "head", "body", "hands", "feet", "accessory"],
  },
  growthCycle: [
    { level: 2, attributes: { strength: 1 } },
    { level: 3, attributes: { intelligence: 1 } },
    { level: 4, attributes: { agility: 1 } },
    { level: 5, attributes: { vitality: 1, spirit: 1 } },
  ],
};

describe("deriveLayeredStats", () => {
  it("derives base plus global and class growth for the active class", () => {
    const progression = createInitialPlayerProgression();
    progression.global.level = 5;
    progression.classes.otherworlder.level = 5;

    const breakdown = deriveLayeredStats({
      baseStats: createInitialStats(),
      progression,
      classDef: otherworlder,
      raceDef: human,
    });

    expect(breakdown.globalAttributes).toMatchObject({
      strength: 1,
      vitality: 1,
      agility: 1,
      intelligence: 1,
      spirit: 1,
      willpower: 1,
      perception: 1,
      charisma: 1,
    });
    expect(breakdown.classAttributes).toMatchObject({
      strength: 1,
      vitality: 1,
      agility: 1,
      intelligence: 1,
      spirit: 1,
    });
    expect(breakdown.effectiveAttributes.strength).toBe(12);
    expect(breakdown.effectiveAttributes.intelligence).toBe(12);
  });

  it("keeps race multipliers in separate fractional buffers per layer", () => {
    const progression = createInitialPlayerProgression({ raceId: "elf" });
    progression.global.level = 10;
    progression.classes.otherworlder.level = 10;

    const breakdown = deriveLayeredStats({
      baseStats: createInitialStats(),
      progression,
      classDef: otherworlder,
      raceDef: elf,
    });

    expect(breakdown.globalAttributes.agility).toBe(2);
    expect(breakdown.globalAttributes.vitality).toBe(2);
    expect(breakdown.classAttributes.agility).toBe(2);
    expect(breakdown.classAttributes.vitality).toBe(1);
    expect(breakdown.buffers.global.agility).toBeCloseTo(0.3);
    expect(breakdown.buffers.classes.otherworlder.agility).toBeCloseTo(0.3);
    expect(breakdown.buffers.global.vitality).toBeCloseTo(0.85);
    expect(breakdown.buffers.classes.otherworlder.vitality).toBeCloseTo(0.9);
  });

  it("restores the active class record without applying inactive class growth", () => {
    const progression = createInitialPlayerProgression({ classId: "mage" });
    progression.classes.mage.level = 4;
    progression.classes.otherworlder = { level: 20, xp: 0 };

    const mage: ClassDef = {
      ...otherworlder,
      classId: "mage",
      growthCycle: [{ level: 2, attributes: { intelligence: 1 } }],
    };

    const breakdown = deriveLayeredStats({
      baseStats: createInitialStats(),
      progression,
      classDef: mage,
      raceDef: human,
    });

    expect(breakdown.classId).toBe("mage");
    expect(breakdown.classLevel).toBe(4);
    expect(breakdown.classAttributes.intelligence).toBe(3);
    expect(breakdown.classAttributes.strength).toBe(0);
  });

  it("applies equipment bonuses as a separate non-growth layer", () => {
    const stats = createInitialStats();
    stats.resources.hp = 75;

    const breakdown = deriveLayeredStats({
      baseStats: stats,
      progression: createInitialPlayerProgression(),
      classDef: otherworlder,
      raceDef: human,
      equipmentBonuses: {
        "attributes.strength": 2,
        "combat.attack": 3,
        "resources.maxHp": 50,
        "resources.maxEnergy": 20,
      },
    });

    expect(breakdown.equipmentAttributes.strength).toBe(2);
    expect(breakdown.equipmentCombat.attack).toBe(3);
    expect(breakdown.equipmentResources.maxHp).toBe(50);
    expect(breakdown.effectiveAttributes.strength).toBe(12);

    applyLayeredStats(stats, breakdown);

    expect(stats.resources.hp).toBe(75);
    expect(stats.resources.maxHp).toBe(150);
    expect(stats.resources.maxEnergy).toBe(120);
    expect(stats.combat.attack).toBe(14);
  });
});
