import type {
  CharacterSkills,
  CombatStats,
  CoreAttributes,
  StatResources,
  Stats,
} from "../components";
import { QUEST_STAT_NAME_OPTIONS } from "../content/editingMetadata";

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

/**
 * Authored overrides for a fresh playthrough's starting stats.
 *
 * The shape matches the game config newGame section structurally; when a field
 * is omitted, the engine defaults keep tests and isolated instances
 * self-contained.
 */
export interface InitialStatsConfig {
  startingCurrency?: number;
  maxEnergy?: number;
  attributes?: CoreAttributes;
  skills?: CharacterSkills;
}

export function createInitialStats(config?: InitialStatsConfig): Stats {
  const maxEnergy = config?.maxEnergy ?? 100;
  const stats: Stats = {
    type: "Stats",
    currency: config?.startingCurrency ?? 1550,
    resources: {
      hp: 0,
      maxHp: 0,
      mp: 0,
      maxMp: 0,
      sp: 0,
      maxSp: 0,
      energy: maxEnergy,
      maxEnergy,
    },
    attributes: { ...(config?.attributes ?? INITIAL_ATTRIBUTES) },
    combat: {
      attack: 0,
      magicAttack: 0,
      defense: 0,
      magicDefense: 0,
    },
    skills: { ...(config?.skills ?? INITIAL_SKILLS) },
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
    conditions: stats.conditions.map((c) => ({ ...c })),
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
  return (QUEST_STAT_NAME_OPTIONS as readonly string[]).includes(value);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
