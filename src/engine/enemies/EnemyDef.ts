import type {
  CharacterCondition,
  CharacterProgression,
  CharacterSkills,
  CombatStats,
  CoreAttributes,
  StatResources,
} from "../components";

/**
 * Full authored stat block for an enemy, using the same sections as the
 * player character.
 *
 * Every section and field is required except conditions. Balance guardrails
 * and stat roles (HP controls fight length, ATK controls threat, Agility and
 * Spirit control QTE pressure) are documented in docs/combat-balance.md.
 */
export interface EnemyStatsData {
  /** Current and maximum pools; hp should usually start at maxHp. */
  resources: StatResources;
  attributes: CoreAttributes;
  /** Flat combat values; enemies do not derive these from attributes. */
  combat: CombatStats;
  skills: CharacterSkills;
  /** Flavor progression shown by UI, e.g. "Wild Monster". */
  progression: CharacterProgression;
  /** Optional starting status conditions; defaults to none. */
  conditions?: CharacterCondition[];
}

/**
 * One item stack granted to the player when the enemy is defeated.
 */
export interface EnemyLootEntry {
  /** Must exist in the item catalog. */
  itemId: string;
  /** Positive integer amount added to the inventory. */
  quantity: number;
}

/**
 * Combat profile attached to an NPC.
 *
 * Enemies are regular NPCs (identity, dialogue, and map presence come from
 * the NPC definition with the same npcId); this file only adds what combat
 * needs. Walking into or interacting with a combatable NPC starts combat
 * instead of dialogue.
 */
export interface EnemyDef {
  /** Stable id of the NPC this combat profile belongs to. */
  npcId: string;
  /** When false, the profile is inert and the NPC keeps talking normally. */
  combatable: boolean;
  /** Authored combat stats; see docs/combat-balance.md for target ranges. */
  stats: EnemyStatsData;
  /** Victory loot; an empty array is valid. */
  loot: EnemyLootEntry[];
}

/**
 * Map of NPC ids to enemy definitions as loaded from content.
 */
export type EnemyDefMap = Record<string, EnemyDef>;
