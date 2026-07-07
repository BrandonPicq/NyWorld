import type { ClassDef } from "../classes/ClassDef";
import type { CoreAttributes, Stats } from "../components/Stats";
import type { RaceDef } from "../races/RaceDef";
import {
  cloneStats,
  deriveCombatStats,
  deriveMaxHp,
  deriveMaxMp,
  deriveMaxSp,
} from "./characterStats";

export const DEFAULT_PLAYER_CLASS_ID = "otherworlder";
export const DEFAULT_PLAYER_RACE_ID = "human";

export type CoreAttributeKey = keyof CoreAttributes;

export type AttributeValues = Record<CoreAttributeKey, number>;

export interface PlayerClassProgression {
  level: number;
  xp: number;
}

export interface ProgressionFractionalBuffers {
  global: AttributeValues;
  classes: Record<string, AttributeValues>;
}

export interface PlayerProgressionState {
  global: PlayerClassProgression;
  classes: Record<string, PlayerClassProgression>;
  buffers: ProgressionFractionalBuffers;
  classId: string;
  raceId: string;
}

export interface LayeredStatBreakdown {
  classId: string;
  raceId: string;
  globalLevel: number;
  classLevel: number;
  baseAttributes: AttributeValues;
  globalAttributes: AttributeValues;
  classAttributes: AttributeValues;
  equipmentAttributes: AttributeValues;
  effectiveAttributes: AttributeValues;
  buffers: ProgressionFractionalBuffers;
}

const ATTRIBUTE_KEYS: CoreAttributeKey[] = [
  "strength",
  "vitality",
  "agility",
  "intelligence",
  "spirit",
  "willpower",
  "perception",
  "charisma",
];

const GLOBAL_GROWTH_CYCLE: AttributeValues[] = [
  createAttributeValues({ vitality: 1, willpower: 1 }),
  createAttributeValues({ perception: 1, charisma: 1 }),
  createAttributeValues({ agility: 1, spirit: 1 }),
  createAttributeValues({ strength: 1, intelligence: 1 }),
];

export function createInitialPlayerProgression(input: {
  classId?: string;
  raceId?: string;
} = {}): PlayerProgressionState {
  const classId = input.classId ?? DEFAULT_PLAYER_CLASS_ID;
  return {
    global: { level: 1, xp: 0 },
    classes: {
      [classId]: { level: 1, xp: 0 },
    },
    buffers: {
      global: createEmptyAttributeValues(),
      classes: {
        [classId]: createEmptyAttributeValues(),
      },
    },
    classId,
    raceId: input.raceId ?? DEFAULT_PLAYER_RACE_ID,
  };
}

export function clonePlayerProgressionState(
  state: PlayerProgressionState,
): PlayerProgressionState {
  return {
    global: { ...state.global },
    classes: Object.fromEntries(
      Object.entries(state.classes).map(([classId, record]) => [
        classId,
        { ...record },
      ]),
    ),
    buffers: {
      global: cloneAttributeValues(state.buffers.global),
      classes: Object.fromEntries(
        Object.entries(state.buffers.classes).map(([classId, buffers]) => [
          classId,
          cloneAttributeValues(buffers),
        ]),
      ),
    },
    classId: state.classId,
    raceId: state.raceId,
  };
}

export function cloneLayeredStatBreakdown(
  breakdown: LayeredStatBreakdown,
): LayeredStatBreakdown {
  return {
    classId: breakdown.classId,
    raceId: breakdown.raceId,
    globalLevel: breakdown.globalLevel,
    classLevel: breakdown.classLevel,
    baseAttributes: cloneAttributeValues(breakdown.baseAttributes),
    globalAttributes: cloneAttributeValues(breakdown.globalAttributes),
    classAttributes: cloneAttributeValues(breakdown.classAttributes),
    equipmentAttributes: cloneAttributeValues(breakdown.equipmentAttributes),
    effectiveAttributes: cloneAttributeValues(breakdown.effectiveAttributes),
    buffers: {
      global: cloneAttributeValues(breakdown.buffers.global),
      classes: Object.fromEntries(
        Object.entries(breakdown.buffers.classes).map(([classId, buffers]) => [
          classId,
          cloneAttributeValues(buffers),
        ]),
      ),
    },
  };
}

export function deriveLayeredStats(input: {
  baseStats: Stats;
  progression: PlayerProgressionState;
  classDef: ClassDef;
  raceDef: RaceDef;
}): LayeredStatBreakdown {
  const progression = ensureProgressionRecords(input.progression);
  const baseAttributes = cloneAttributeValues(input.baseStats.attributes);
  const globalLayer = deriveGrowthLayer({
    level: progression.global.level,
    cycle: GLOBAL_GROWTH_CYCLE,
    raceDef: input.raceDef,
  });
  const classRecord = progression.classes[progression.classId] ?? {
    level: 1,
    xp: 0,
  };
  const classLayer = deriveGrowthLayer({
    level: classRecord.level,
    cycle: input.classDef.growthCycle.map((entry) =>
      createAttributeValues(entry.attributes),
    ),
    raceDef: input.raceDef,
  });
  const equipmentAttributes = createEmptyAttributeValues();
  const effectiveAttributes = addAttributeValues(
    baseAttributes,
    globalLayer.attributes,
    classLayer.attributes,
    equipmentAttributes,
  );

  return {
    classId: progression.classId,
    raceId: progression.raceId,
    globalLevel: progression.global.level,
    classLevel: classRecord.level,
    baseAttributes,
    globalAttributes: globalLayer.attributes,
    classAttributes: classLayer.attributes,
    equipmentAttributes,
    effectiveAttributes,
    buffers: {
      global: globalLayer.buffers,
      classes: {
        ...progression.buffers.classes,
        [progression.classId]: classLayer.buffers,
      },
    },
  };
}

export function applyLayeredStats(stats: Stats, breakdown: LayeredStatBreakdown): void {
  const previousResources = { ...stats.resources };
  stats.attributes = cloneAttributeValues(breakdown.effectiveAttributes);
  stats.resources.maxHp = deriveMaxHp(stats.attributes);
  stats.resources.maxMp = deriveMaxMp(stats.attributes);
  stats.resources.maxSp = deriveMaxSp(stats.attributes);
  stats.resources.hp = clamp(previousResources.hp, 0, stats.resources.maxHp);
  stats.resources.mp = clamp(previousResources.mp, 0, stats.resources.maxMp);
  stats.resources.sp = clamp(previousResources.sp, 0, stats.resources.maxSp);
  stats.resources.energy = clamp(
    previousResources.energy,
    0,
    stats.resources.maxEnergy,
  );
  stats.combat = deriveCombatStats(stats.attributes, stats.skills);
}

export function createStatsWithLayeredAttributes(input: {
  baseStats: Stats;
  progression: PlayerProgressionState;
  classDef: ClassDef;
  raceDef: RaceDef;
}): { stats: Stats; breakdown: LayeredStatBreakdown } {
  const stats = cloneStats(input.baseStats);
  const breakdown = deriveLayeredStats(input);
  applyLayeredStats(stats, breakdown);
  return { stats, breakdown };
}

export function normalizeProgressionBuffers(
  progression: PlayerProgressionState,
  breakdown: LayeredStatBreakdown,
): PlayerProgressionState {
  const next = clonePlayerProgressionState(progression);
  next.buffers.global = cloneAttributeValues(breakdown.buffers.global);
  next.buffers.classes[progression.classId] = cloneAttributeValues(
    breakdown.buffers.classes[progression.classId] ?? createEmptyAttributeValues(),
  );
  return next;
}

function deriveGrowthLayer(input: {
  level: number;
  cycle: readonly AttributeValues[];
  raceDef: RaceDef;
}): { attributes: AttributeValues; buffers: AttributeValues } {
  const attributes = createEmptyAttributeValues();
  const buffers = createEmptyAttributeValues();
  const level = Math.max(1, Math.floor(input.level));

  if (input.cycle.length === 0) {
    return { attributes, buffers };
  }

  for (let reachedLevel = 2; reachedLevel <= level; reachedLevel++) {
    const cycleIndex = (reachedLevel - 2) % input.cycle.length;
    const gains = input.cycle[cycleIndex];
    for (const attribute of ATTRIBUTE_KEYS) {
      const gain = gains[attribute];
      if (gain <= 0) continue;

      const multiplier = input.raceDef.growthMultipliers[attribute] ?? 1;
      const scaled = gain * multiplier;
      const whole = Math.floor(scaled);
      attributes[attribute] += whole;
      buffers[attribute] += scaled - whole;
      while (buffers[attribute] >= 1) {
        attributes[attribute] += 1;
        buffers[attribute] -= 1;
      }
    }
  }

  return { attributes, buffers: normalizeBufferPrecision(buffers) };
}

function ensureProgressionRecords(
  progression: PlayerProgressionState,
): PlayerProgressionState {
  const next = clonePlayerProgressionState(progression);
  next.classes[next.classId] ??= { level: 1, xp: 0 };
  next.buffers.classes[next.classId] ??= createEmptyAttributeValues();
  return next;
}

function createAttributeValues(
  values: Partial<Record<CoreAttributeKey, number>>,
): AttributeValues {
  return {
    ...createEmptyAttributeValues(),
    ...values,
  };
}

function createEmptyAttributeValues(): AttributeValues {
  return {
    strength: 0,
    vitality: 0,
    agility: 0,
    intelligence: 0,
    spirit: 0,
    willpower: 0,
    perception: 0,
    charisma: 0,
  };
}

function cloneAttributeValues(values: CoreAttributes): AttributeValues {
  return { ...values };
}

function addAttributeValues(...layers: readonly AttributeValues[]): AttributeValues {
  const total = createEmptyAttributeValues();
  for (const layer of layers) {
    for (const attribute of ATTRIBUTE_KEYS) {
      total[attribute] += layer[attribute];
    }
  }
  return total;
}

export function subtractAttributeValues(
  values: AttributeValues,
  ...layers: readonly AttributeValues[]
): AttributeValues {
  const total = cloneAttributeValues(values);
  for (const layer of layers) {
    for (const attribute of ATTRIBUTE_KEYS) {
      total[attribute] -= layer[attribute];
    }
  }
  return total;
}

function normalizeBufferPrecision(buffers: AttributeValues): AttributeValues {
  const next = createEmptyAttributeValues();
  for (const attribute of ATTRIBUTE_KEYS) {
    next[attribute] = Number(buffers[attribute].toFixed(6));
  }
  return next;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
