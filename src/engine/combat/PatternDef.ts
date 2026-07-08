import type { EquipmentWeaponType } from "../classes/ClassDef";

/**
 * Damage school of a learned QTE pattern: `physical` resolves through
 * attack/defense, `magical` through magicAttack/magicDefense — the same schools
 * `resolveQteContest` already understands.
 */
export type PatternKind = "physical" | "magical";

/**
 * Evolution link: a pattern is auto-learned from a source pattern once the
 * source has been used enough times and the player is high-level enough.
 */
export interface PatternEvolution {
  patternId: string;
  usageRequired: number;
}

/**
 * Authored definition of a learnable QTE pattern (fireball, crosscut, ...).
 *
 * Patterns are learned (tomes / evolution), never derived from masteries. The
 * sequence is fixed and hidden during execution; only the picker and the sheet
 * reveal it (ADR 0009).
 */
export interface PatternDef {
  patternId: string;
  name: string;
  description: string;
  kind: PatternKind;
  /** Fixed arrow sequence (4 to 8 inputs) memorized by the player. */
  inputs: string[];
  /** Tight time budget for the whole sequence, in milliseconds. */
  timeLimitMs: number;
  /** MP spent on selection (never refunded on a failed QTE). */
  mpCost: number;
  /** Multiplier applied to the resolved damage. */
  damageMultiplier: number;
  /** Global player level required to learn it. */
  requiredPlayerLevel: number;
  /** Effective intelligence required to learn it. */
  requiredIntelligence: number;
  /** Optional weapon archetypes the equipped weapon must match to use it. */
  requiredWeaponTypes?: EquipmentWeaponType[];
  /** Optional evolution source (both patterns coexist once evolved). */
  evolvesFrom?: PatternEvolution;
}

export type PatternDefMap = Record<string, PatternDef>;

export interface KnownPatternState {
  timesUsed: number;
}

export type KnownPatternMap = Record<string, KnownPatternState>;
