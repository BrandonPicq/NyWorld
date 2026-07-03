import type {
  CharacterSkills,
  CombatStats,
  CoreAttributes,
  StatResources,
  Stats,
} from "../components";

export type StatSection =
  | "resources"
  | "attributes"
  | "combat"
  | "skills"
  | "progression";
export type StatPath =
  | `resources.${keyof StatResources & string}`
  | `attributes.${keyof CoreAttributes & string}`
  | `combat.${keyof CombatStats & string}`
  | `skills.${keyof CharacterSkills & string}`
  | "progression.academicProgress";

const INITIAL_ATTRIBUTES: CoreAttributes = {
  strength: 10,
  vitality: 10,
  agility: 10,
  intelligence: 10,
  spirit: 10,
  willpower: 10,
  perception: 10,
  charisma: 10,
};

const INITIAL_SKILLS: CharacterSkills = {
  melee: 1,
  ranged: 1,
  guard: 1,
  evasion: 1,
  spellcasting: 1,
  focus: 1,
  athletics: 1,
  scholarship: 1,
  speech: 1,
};

const STAT_PATHS = [
  "resources.hp",
  "resources.maxHp",
  "resources.mp",
  "resources.maxMp",
  "resources.sp",
  "resources.maxSp",
  "resources.energy",
  "resources.maxEnergy",
  "attributes.strength",
  "attributes.vitality",
  "attributes.agility",
  "attributes.intelligence",
  "attributes.spirit",
  "attributes.willpower",
  "attributes.perception",
  "attributes.charisma",
  "combat.attack",
  "combat.magicAttack",
  "combat.defense",
  "combat.magicDefense",
  "skills.melee",
  "skills.ranged",
  "skills.guard",
  "skills.evasion",
  "skills.spellcasting",
  "skills.focus",
  "skills.athletics",
  "skills.scholarship",
  "skills.speech",
  "progression.academicProgress",
] as const satisfies readonly StatPath[];

export function createInitialStats(): Stats {
  const stats: Stats = {
    type: "Stats",
    currency: 1550,
    resources: {
      hp: 0,
      maxHp: 0,
      mp: 0,
      maxMp: 0,
      sp: 0,
      maxSp: 0,
      energy: 100,
      maxEnergy: 100,
    },
    attributes: { ...INITIAL_ATTRIBUTES },
    combat: {
      attack: 0,
      magicAttack: 0,
      defense: 0,
      magicDefense: 0,
    },
    skills: { ...INITIAL_SKILLS },
    progression: {
      academicTitle: "Novice Scribe",
      academicProgress: 0,
    },
    conditions: [],
  };

  refreshDerivedStats(stats, { refillPrimaryResources: true });
  return stats;
}

export function cloneStats(stats: Stats): Stats {
  return {
    type: "Stats",
    currency: stats.currency,
    resources: { ...stats.resources },
    attributes: { ...stats.attributes },
    combat: { ...stats.combat },
    skills: { ...stats.skills },
    progression: { ...stats.progression },
    conditions: [...stats.conditions],
  };
}

export function refreshDerivedStats(
  stats: Stats,
  options: { refillPrimaryResources?: boolean } = {},
): void {
  const maxHp = deriveMaxHp(stats.attributes);
  const maxMp = deriveMaxMp(stats.attributes);
  const maxSp = deriveMaxSp(stats.attributes);

  stats.resources.maxHp = maxHp;
  stats.resources.maxMp = maxMp;
  stats.resources.maxSp = maxSp;

  if (options.refillPrimaryResources) {
    stats.resources.hp = maxHp;
    stats.resources.mp = maxMp;
  } else {
    stats.resources.hp = clamp(stats.resources.hp, 0, maxHp);
    stats.resources.mp = clamp(stats.resources.mp, 0, maxMp);
  }

  stats.resources.sp = clamp(stats.resources.sp, 0, maxSp);
  stats.resources.energy = clamp(
    stats.resources.energy,
    0,
    stats.resources.maxEnergy,
  );
  stats.combat = deriveCombatStats(stats.attributes, stats.skills);
}

export function deriveMaxHp(attributes: CoreAttributes): number {
  return 50 + attributes.vitality * 5;
}

export function deriveMaxMp(attributes: CoreAttributes): number {
  return 20 + attributes.spirit * 3 + attributes.intelligence * 2;
}

export function deriveMaxSp(attributes: CoreAttributes): number {
  return 50 + attributes.willpower * 3 + attributes.agility * 2;
}

export function deriveCombatStats(
  attributes: CoreAttributes,
  skills: CharacterSkills,
): CombatStats {
  return {
    attack: Math.max(
      1,
      Math.floor(attributes.strength * 0.8 + skills.melee * 2),
    ),
    magicAttack: Math.max(
      1,
      Math.floor(
        attributes.intelligence * 0.5 +
          attributes.spirit * 0.3 +
          skills.spellcasting * 2,
      ),
    ),
    defense: Math.max(
      1,
      Math.floor(attributes.vitality * 0.8 + skills.guard * 2),
    ),
    magicDefense: Math.max(
      1,
      Math.floor(
        attributes.spirit * 0.5 +
          attributes.willpower * 0.3 +
          skills.focus * 2,
      ),
    ),
  };
}

export function getStatValue(stats: Stats, statPath: string): number | undefined {
  const parts = statPath.split(".");
  const [section, key] = parts;
  if (!section || !key || parts.length !== 2) {
    return undefined;
  }

  if (section === "resources" && key in stats.resources) {
    return stats.resources[key as keyof StatResources];
  }
  if (section === "attributes" && key in stats.attributes) {
    return stats.attributes[key as keyof CoreAttributes];
  }
  if (section === "combat" && key in stats.combat) {
    return stats.combat[key as keyof CombatStats];
  }
  if (section === "skills" && key in stats.skills) {
    return stats.skills[key as keyof CharacterSkills];
  }
  if (section === "progression" && key === "academicProgress") {
    return stats.progression.academicProgress;
  }

  return undefined;
}

export function isStatPath(value: string): value is StatPath {
  return (STAT_PATHS as readonly string[]).includes(value);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
