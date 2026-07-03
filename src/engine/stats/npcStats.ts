import type { Stats } from "../components";

const ENEMY_BASE_STATS: Record<string, Partial<Stats>> = {
  slime: {
    resources: {
      hp: 20,
      maxHp: 20,
      mp: 0,
      maxMp: 0,
      sp: 0,
      maxSp: 100,
      energy: 100,
      maxEnergy: 100,
    },
    attributes: {
      strength: 8,
      vitality: 6,
      agility: 4,
      intelligence: 2,
      spirit: 2,
      willpower: 4,
      perception: 4,
      charisma: 1,
    },
    combat: {
      attack: 3,
      magicAttack: 1,
      defense: 1,
      magicDefense: 1,
    },
    skills: {
      melee: 1,
      ranged: 1,
      guard: 1,
      evasion: 1,
      spellcasting: 1,
      focus: 1,
      athletics: 1,
      scholarship: 1,
      speech: 1,
    },
    progression: {
      academicTitle: "Wild Monster",
      academicProgress: 0,
    },
    conditions: [],
  },
  kobold: {
    resources: {
      hp: 100,
      maxHp: 100,
      mp: 70,
      maxMp: 70,
      sp: 100,
      maxSp: 100,
      energy: 100,
      maxEnergy: 100,
    },
    attributes: {
      strength: 10,
      vitality: 10,
      agility: 10,
      intelligence: 10,
      spirit: 10,
      willpower: 10,
      perception: 10,
      charisma: 10,
    },
    combat: {
      attack: 10,
      magicAttack: 10,
      defense: 10,
      magicDefense: 10,
    },
    skills: {
      melee: 1,
      ranged: 1,
      guard: 1,
      evasion: 1,
      spellcasting: 1,
      focus: 1,
      athletics: 1,
      scholarship: 1,
      speech: 1,
    },
    progression: {
      academicTitle: "Fierce Kobold",
      academicProgress: 0,
    },
    conditions: [],
  },
};

export function createNpcStats(npcId: string): Stats {
  const base = ENEMY_BASE_STATS[npcId] ?? ENEMY_BASE_STATS["slime"];
  return {
    type: "Stats",
    currency: base.currency ?? 0,
    resources: { ...base.resources! },
    attributes: { ...base.attributes! },
    combat: { ...base.combat! },
    skills: { ...base.skills! },
    progression: { ...base.progression! },
    conditions: base.conditions ? base.conditions.map((c) => ({ ...c })) : [],
  };
}
