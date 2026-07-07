import type { ClassDef } from "../classes/ClassDef";
import type {
  CombatStats,
  CoreAttributes,
  StatResources,
  Stats,
} from "../components/Stats";
import type { EquipmentBonusMap } from "../items/ItemDef";
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
export const ATTRIBUTE_CHOICE_INTERVAL = 3;
export const ATTRIBUTE_CHOICE_AMOUNT = 1;

export type CoreAttributeKey = keyof CoreAttributes;

export type AttributeValues = Record<CoreAttributeKey, number>;
export type CombatBonusValues = Record<keyof CombatStats, number>;
export type ResourceBonusValues = Pick<
  StatResources,
  "maxHp" | "maxMp" | "maxSp" | "maxEnergy"
>;

export interface PlayerClassProgression {
  level: number;
  xp: number;
}

export interface CommandMasteryState {
  level: number;
  usage: number;
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
  pendingAttributeChoices: number;
  masteries?: Record<string, CommandMasteryState>;
}

export interface XpAwardResult {
  amount: number;
  globalLevelsGained: number[];
  classLevelsGained: Array<{ classId: string; level: number }>;
  attributeChoicesGained: number;
}

export interface LayeredStatBreakdown {
  classId: string;
  raceId: string;
  globalLevel: number;
  classLevel: number;
  globalXp: number;
  globalXpToNext: number;
  classXp: number;
  classXpToNext: number;
  pendingAttributeChoices: number;
  baseAttributes: AttributeValues;
  globalAttributes: AttributeValues;
  classAttributes: AttributeValues;
  equipmentAttributes: AttributeValues;
  equipmentCombat: CombatBonusValues;
  equipmentResources: ResourceBonusValues;
  baseResources: ResourceBonusValues;
  effectiveAttributes: AttributeValues;
  buffers: ProgressionFractionalBuffers;
  masteries: Record<string, CommandMasteryState>;
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

export const GLOBAL_GROWTH_CYCLE: AttributeValues[] = [
  createAttributeValues({ vitality: 1, willpower: 1 }),
  createAttributeValues({ perception: 1, charisma: 1 }),
  createAttributeValues({ agility: 1, spirit: 1 }),
  createAttributeValues({ strength: 1, intelligence: 1 }),
];

export const ALL_COMMAND_IDS = [
  "strike",
  "guard",
  "cast",
  "focus",
  "flee",
  "use_item",
  "study",
  "rest",
] as const;

export function ensureCommandMasteries(
  masteries?: Record<string, CommandMasteryState>,
): Record<string, CommandMasteryState> {
  const next = {} as Record<string, CommandMasteryState>;
  for (const cmd of ALL_COMMAND_IDS) {
    const existing = masteries?.[cmd];
    next[cmd] = {
      level: existing?.level ?? 0,
      usage: existing?.usage ?? 0,
    };
  }
  return next;
}

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
    pendingAttributeChoices: 0,
    masteries: ensureCommandMasteries(),
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
    pendingAttributeChoices: state.pendingAttributeChoices,
    masteries: ensureCommandMasteries(state.masteries),
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
    globalXp: breakdown.globalXp,
    globalXpToNext: breakdown.globalXpToNext,
    classXp: breakdown.classXp,
    classXpToNext: breakdown.classXpToNext,
    pendingAttributeChoices: breakdown.pendingAttributeChoices,
    baseAttributes: cloneAttributeValues(breakdown.baseAttributes),
    globalAttributes: cloneAttributeValues(breakdown.globalAttributes),
    classAttributes: cloneAttributeValues(breakdown.classAttributes),
    equipmentAttributes: cloneAttributeValues(breakdown.equipmentAttributes),
    equipmentCombat: { ...breakdown.equipmentCombat },
    equipmentResources: { ...breakdown.equipmentResources },
    baseResources: { ...breakdown.baseResources },
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
    masteries: ensureCommandMasteries(breakdown.masteries),
  };
}

export function deriveLayeredStats(input: {
  baseStats: Stats;
  progression: PlayerProgressionState;
  classDef: ClassDef;
  raceDef: RaceDef;
  equipmentBonuses?: EquipmentBonusMap;
}): LayeredStatBreakdown {
  const progression = ensureProgressionRecords(input.progression);
  const baseAttributes = cloneAttributeValues(input.baseStats.attributes);
  const baseResources = cloneResourceBonusValues(input.baseStats.resources);
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
  const equipment = deriveEquipmentLayers(input.equipmentBonuses ?? {});
  const effectiveAttributes = addAttributeValues(
    baseAttributes,
    globalLayer.attributes,
    classLayer.attributes,
    equipment.attributes,
  );

  return {
    classId: progression.classId,
    raceId: progression.raceId,
    globalLevel: progression.global.level,
    classLevel: classRecord.level,
    globalXp: progression.global.xp,
    globalXpToNext: getGlobalXpToNext(progression.global.level),
    classXp: classRecord.xp,
    classXpToNext: getClassXpToNext(classRecord.level),
    pendingAttributeChoices: progression.pendingAttributeChoices,
    baseAttributes,
    globalAttributes: globalLayer.attributes,
    classAttributes: classLayer.attributes,
    equipmentAttributes: equipment.attributes,
    equipmentCombat: equipment.combat,
    equipmentResources: equipment.resources,
    baseResources,
    effectiveAttributes,
    buffers: {
      global: globalLayer.buffers,
      classes: {
        ...progression.buffers.classes,
        [progression.classId]: classLayer.buffers,
      },
    },
    masteries: ensureCommandMasteries(progression.masteries),
  };
}

export function applyLayeredStats(stats: Stats, breakdown: LayeredStatBreakdown): void {
  const previousResources = { ...stats.resources };
  stats.attributes = cloneAttributeValues(breakdown.effectiveAttributes);
  stats.resources.maxHp =
    deriveMaxHp(stats.attributes) + breakdown.equipmentResources.maxHp;
  stats.resources.maxMp =
    deriveMaxMp(stats.attributes) + breakdown.equipmentResources.maxMp;
  stats.resources.maxSp =
    deriveMaxSp(stats.attributes) + breakdown.equipmentResources.maxSp;
  stats.resources.maxEnergy =
    breakdown.baseResources.maxEnergy +
    breakdown.equipmentResources.maxEnergy;
  stats.resources.hp = clamp(previousResources.hp, 0, stats.resources.maxHp);
  stats.resources.mp = clamp(previousResources.mp, 0, stats.resources.maxMp);
  stats.resources.sp = clamp(previousResources.sp, 0, stats.resources.maxSp);
  stats.resources.energy = clamp(
    previousResources.energy,
    0,
    stats.resources.maxEnergy,
  );
  const combat = deriveCombatStats(stats.attributes, stats.skills);
  stats.combat = {
    attack: combat.attack + breakdown.equipmentCombat.attack,
    magicAttack: combat.magicAttack + breakdown.equipmentCombat.magicAttack,
    defense: combat.defense + breakdown.equipmentCombat.defense,
    magicDefense:
      combat.magicDefense + breakdown.equipmentCombat.magicDefense,
  };
}

export function createStatsWithLayeredAttributes(input: {
  baseStats: Stats;
  progression: PlayerProgressionState;
  classDef: ClassDef;
  raceDef: RaceDef;
  equipmentBonuses?: EquipmentBonusMap;
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

export function getGlobalXpToNext(level: number): number {
  const currentLevel = Math.max(1, Math.floor(level));
  const levelOffset = currentLevel - 1;
  return 100 + levelOffset * 50 + levelOffset * levelOffset * 10;
}

export function getClassXpToNext(level: number): number {
  const currentLevel = Math.max(1, Math.floor(level));
  const levelOffset = currentLevel - 1;
  return 80 + levelOffset * 40 + levelOffset * levelOffset * 8;
}

export function applyXpAwardToProgression(
  state: PlayerProgressionState,
  rawAmount: number,
): { progression: PlayerProgressionState; result: XpAwardResult } {
  const amount = Math.max(0, Math.floor(rawAmount));
  const progression = ensureProgressionRecords(state);
  const result: XpAwardResult = {
    amount,
    globalLevelsGained: [],
    classLevelsGained: [],
    attributeChoicesGained: 0,
  };

  if (amount <= 0) {
    return { progression, result };
  }

  progression.global.xp += amount;
  while (progression.global.xp >= getGlobalXpToNext(progression.global.level)) {
    progression.global.xp -= getGlobalXpToNext(progression.global.level);
    progression.global.level += 1;
    result.globalLevelsGained.push(progression.global.level);
    if (progression.global.level % ATTRIBUTE_CHOICE_INTERVAL === 0) {
      progression.pendingAttributeChoices += ATTRIBUTE_CHOICE_AMOUNT;
      result.attributeChoicesGained += ATTRIBUTE_CHOICE_AMOUNT;
    }
  }

  const classRecord = progression.classes[progression.classId];
  classRecord.xp += amount;
  while (classRecord.xp >= getClassXpToNext(classRecord.level)) {
    classRecord.xp -= getClassXpToNext(classRecord.level);
    classRecord.level += 1;
    result.classLevelsGained.push({
      classId: progression.classId,
      level: classRecord.level,
    });
  }

  return { progression, result };
}

export function deriveGrowthLayer(input: {
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
  next.pendingAttributeChoices = Math.max(
    0,
    Math.floor(next.pendingAttributeChoices ?? 0),
  );
  next.masteries = ensureCommandMasteries(next.masteries);
  return next;
}

export function createAttributeValues(
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

function createEmptyCombatBonuses(): CombatBonusValues {
  return {
    attack: 0,
    magicAttack: 0,
    defense: 0,
    magicDefense: 0,
  };
}

function createEmptyResourceBonuses(): ResourceBonusValues {
  return {
    maxHp: 0,
    maxMp: 0,
    maxSp: 0,
    maxEnergy: 0,
  };
}

function cloneAttributeValues(values: CoreAttributes): AttributeValues {
  return { ...values };
}

function cloneResourceBonusValues(resources: StatResources): ResourceBonusValues {
  return {
    maxHp: resources.maxHp,
    maxMp: resources.maxMp,
    maxSp: resources.maxSp,
    maxEnergy: resources.maxEnergy,
  };
}

function deriveEquipmentLayers(bonuses: EquipmentBonusMap): {
  attributes: AttributeValues;
  combat: CombatBonusValues;
  resources: ResourceBonusValues;
} {
  const attributes = createEmptyAttributeValues();
  const combat = createEmptyCombatBonuses();
  const resources = createEmptyResourceBonuses();

  for (const [bonusKey, value] of Object.entries(bonuses)) {
    if (value === undefined) continue;

    const [group, key] = bonusKey.split(".") as [string, string];
    if (group === "attributes" && key in attributes) {
      attributes[key as CoreAttributeKey] += value;
      continue;
    }
    if (group === "combat" && key in combat) {
      combat[key as keyof CombatStats] += value;
      continue;
    }
    if (group === "resources" && key in resources) {
      resources[key as keyof ResourceBonusValues] += value;
    }
  }

  return { attributes, combat, resources };
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
