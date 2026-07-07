import type {
  ContentCatalogSnapshot,
  ContentValidationContext,
  EnemyDef,
  EnemyLootEntry,
  EnemyStatsData,
  NpcDef,
} from "../../../engine";
import { cloneEnemyStats } from "../../../engine";

export const ENEMY_RESOURCE_FIELDS = [
  "hp",
  "maxHp",
  "mp",
  "maxMp",
  "sp",
  "maxSp",
  "energy",
  "maxEnergy",
] as const;

export const ENEMY_ATTRIBUTE_FIELDS = [
  "strength",
  "vitality",
  "agility",
  "intelligence",
  "spirit",
  "willpower",
  "perception",
  "charisma",
] as const;

export const ENEMY_COMBAT_FIELDS = [
  "attack",
  "magicAttack",
  "defense",
  "magicDefense",
] as const;

export const ENEMY_SKILL_FIELDS = [
  "melee",
  "ranged",
  "guard",
  "evasion",
  "spellcasting",
  "focus",
  "athletics",
  "scholarship",
  "speech",
] as const;

export type EnemyNumericStatSection =
  | "resources"
  | "attributes"
  | "combat"
  | "skills";

export interface EnemyStatSectionConfig {
  section: EnemyNumericStatSection;
  label: string;
  fields: readonly string[];
}

export const ENEMY_STAT_SECTIONS: readonly EnemyStatSectionConfig[] = [
  {
    section: "resources",
    label: "Resources",
    fields: ENEMY_RESOURCE_FIELDS,
  },
  {
    section: "attributes",
    label: "Attributes",
    fields: ENEMY_ATTRIBUTE_FIELDS,
  },
  {
    section: "combat",
    label: "Combat",
    fields: ENEMY_COMBAT_FIELDS,
  },
  {
    section: "skills",
    label: "Skills",
    fields: ENEMY_SKILL_FIELDS,
  },
];

export interface EditorEnemyNpcEntry {
  npcId: string;
  name: string;
  hasProfile: boolean;
  combatable: boolean;
}

export function listEnemyNpcEntries(
  npcs: readonly NpcDef[],
  enemies: readonly EnemyDef[],
): EditorEnemyNpcEntry[] {
  const enemyByNpcId = new Map(
    enemies.map((enemy) => [enemy.npcId, enemy]),
  );

  return npcs
    .map((npc) => {
      const enemy = enemyByNpcId.get(npc.npcId);
      return {
        npcId: npc.npcId,
        name: npc.name,
        hasProfile: enemy !== undefined,
        combatable: enemy?.combatable === true,
      };
    })
    .sort((a, b) => a.npcId.localeCompare(b.npcId));
}

export function enemyContentPath(npcId: string): string {
  return `src/content/enemies/${npcId}.json`;
}

export function cloneEnemyDefs(enemies: readonly EnemyDef[]): EnemyDef[] {
  return enemies.map(cloneEnemyDef);
}

export function createEnemyDraftSnapshot(
  snapshot: ContentCatalogSnapshot,
  draftEnemies: readonly EnemyDef[],
): ContentCatalogSnapshot {
  return {
    ...snapshot,
    enemies: cloneEnemyDefs(draftEnemies),
  };
}

export function createEnemyDraftValidationContext(
  context: ContentValidationContext,
  draftEnemies: readonly EnemyDef[],
): ContentValidationContext {
  return {
    ...context,
    enemyIds: new Set(draftEnemies.map((enemy) => enemy.npcId)),
  };
}

export function serializeEnemyDef(enemy: EnemyDef): string {
  return JSON.stringify(enemy, null, 2);
}

export function serializeEnemyDefsById(
  enemies: readonly EnemyDef[],
): Map<string, string> {
  return new Map(
    enemies.map((enemy) => [enemy.npcId, serializeEnemyDef(enemy)]),
  );
}

export function createEnemyDefForNpc(npc: NpcDef): EnemyDef {
  return {
    npcId: npc.npcId,
    combatable: true,
    stats: createDefaultEnemyStats(npc),
    loot: [],
  };
}

export function upsertEnemyDef(
  enemies: readonly EnemyDef[],
  enemy: EnemyDef,
): EnemyDef[] {
  const exists = enemies.some((entry) => entry.npcId === enemy.npcId);
  const next = exists
    ? enemies.map((entry) =>
        entry.npcId === enemy.npcId
          ? cloneEnemyDef(enemy)
          : cloneEnemyDef(entry),
      )
    : [...enemies, cloneEnemyDef(enemy)];

  return next.sort((a, b) => a.npcId.localeCompare(b.npcId));
}

export function updateEnemyDef(
  enemies: readonly EnemyDef[],
  npcId: string,
  updater: (enemy: EnemyDef) => EnemyDef,
): EnemyDef[] {
  return enemies.map((enemy) =>
    enemy.npcId === npcId
      ? cloneEnemyDef(updater(cloneEnemyDef(enemy)))
      : cloneEnemyDef(enemy),
  );
}

export function removeEnemyDef(
  enemies: readonly EnemyDef[],
  npcId: string,
): EnemyDef[] {
  return enemies
    .filter((enemy) => enemy.npcId !== npcId)
    .map((enemy) => cloneEnemyDef(enemy));
}

export function updateEnemyStatValue(
  enemy: EnemyDef,
  section: EnemyNumericStatSection,
  field: string,
  value: number,
): EnemyDef {
  const next = cloneEnemyDef(enemy);
  const sectionValues = next.stats[section] as unknown as Record<string, number>;
  sectionValues[field] = value;
  return next;
}

export function updateEnemyProgression(
  enemy: EnemyDef,
  patch: Partial<EnemyStatsData["progression"]>,
): EnemyDef {
  const next = cloneEnemyDef(enemy);
  next.stats.progression = {
    ...next.stats.progression,
    ...patch,
  };
  return next;
}

export function setEnemyXpReward(
  enemy: EnemyDef,
  value: number | undefined,
): EnemyDef {
  const next = cloneEnemyDef(enemy);
  if (value === undefined || Number.isNaN(value)) {
    delete next.xpReward;
  } else {
    next.xpReward = value;
  }
  return next;
}

export function addEnemyLootEntry(enemy: EnemyDef, itemId: string): EnemyDef {
  if (!itemId) {
    return cloneEnemyDef(enemy);
  }

  const next = cloneEnemyDef(enemy);
  next.loot.push({ itemId, quantity: 1 });
  return next;
}

export function updateEnemyLootEntry(
  enemy: EnemyDef,
  index: number,
  patch: Partial<EnemyLootEntry>,
): EnemyDef {
  const next = cloneEnemyDef(enemy);
  if (index < 0 || index >= next.loot.length) {
    return next;
  }
  next.loot[index] = { ...next.loot[index], ...patch };
  return next;
}

export function removeEnemyLootEntry(
  enemy: EnemyDef,
  index: number,
): EnemyDef {
  const next = cloneEnemyDef(enemy);
  next.loot = next.loot.filter((_, entryIndex) => entryIndex !== index);
  return next;
}

function createDefaultEnemyStats(npc: NpcDef): EnemyStatsData {
  return {
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
      strength: 6,
      vitality: 6,
      agility: 6,
      intelligence: 4,
      spirit: 4,
      willpower: 5,
      perception: 5,
      charisma: 3,
    },
    combat: {
      attack: 4,
      magicAttack: 1,
      defense: 2,
      magicDefense: 2,
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
      academicTitle: `${npc.name.trim() || npc.npcId} Enemy`,
      academicProgress: 0,
    },
    conditions: [],
  };
}

function cloneEnemyDef(enemy: EnemyDef): EnemyDef {
  return {
    ...enemy,
    stats: cloneEnemyStats(enemy.stats),
    loot: enemy.loot.map((entry) => ({ ...entry })),
  };
}
