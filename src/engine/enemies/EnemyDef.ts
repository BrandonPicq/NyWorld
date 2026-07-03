import type {
  CharacterCondition,
  CharacterProgression,
  CharacterSkills,
  CombatStats,
  CoreAttributes,
  StatResources,
} from "../components";

export interface EnemyStatsData {
  resources: StatResources;
  attributes: CoreAttributes;
  combat: CombatStats;
  skills: CharacterSkills;
  progression: CharacterProgression;
  conditions?: CharacterCondition[];
}

export interface EnemyLootEntry {
  itemId: string;
  quantity: number;
}

export interface EnemyDef {
  npcId: string;
  combatable: boolean;
  stats: EnemyStatsData;
  loot: EnemyLootEntry[];
}

export type EnemyDefMap = Record<string, EnemyDef>;
