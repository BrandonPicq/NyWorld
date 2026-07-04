import type { Component } from "../ecs/types";

/**
 * Consumable pools tracked during play.
 *
 * hp/mp/sp are combat pools; energy is the out-of-combat stamina spent by
 * movement, study, and similar activities. For the player, the max values are
 * derived from attributes by refreshDerivedStats; enemy content authors both
 * current and max values directly.
 */
export interface StatResources {
  hp: number;
  maxHp: number;
  mp: number;
  maxMp: number;
  sp: number;
  maxSp: number;
  energy: number;
  maxEnergy: number;
}

/**
 * Innate character attributes feeding derived pools and combat values.
 *
 * Combat-relevant roles: vitality drives max HP, spirit and intelligence
 * drive max MP, willpower and agility drive max SP, agility controls physical
 * QTE pressure, and spirit controls magical QTE pressure
 * (see docs/combat-balance.md).
 */
export interface CoreAttributes {
  strength: number;
  vitality: number;
  agility: number;
  intelligence: number;
  spirit: number;
  willpower: number;
  perception: number;
  charisma: number;
}

/**
 * Effective offensive and defensive combat values.
 *
 * Player values are derived from attributes and skills; enemy content
 * authors them directly. attack/defense pair for physical actions,
 * magicAttack/magicDefense for magical ones.
 */
export interface CombatStats {
  attack: number;
  magicAttack: number;
  defense: number;
  magicDefense: number;
}

/**
 * Learned proficiencies feeding derived combat values and future activities.
 */
export interface CharacterSkills {
  melee: number;
  ranged: number;
  guard: number;
  evasion: number;
  spellcasting: number;
  focus: number;
  athletics: number;
  scholarship: number;
  speech: number;
}

/**
 * Academic career progression shown by UI panels.
 */
export interface CharacterProgression {
  /** Display title, e.g. "Novice Scribe" or "Wild Monster" for enemies. */
  academicTitle: string;
  /** Progress toward the next title, clamped to 0-100 by gameplay. */
  academicProgress: number;
}

/**
 * One temporary or permanent status affecting a character.
 */
export interface CharacterCondition {
  /** Stable condition id for gameplay rules. */
  id: string;
  /** Display name shown by UI. */
  name: string;
  /** Remaining duration in engine ticks; omitted means permanent. */
  durationInTicks?: number;
}

/**
 * Player-facing numeric state used by simulation, progression, and UI panels.
 *
 * Combat values are refreshed from attributes and skills whenever stats are
 * created or restored. Future equipment bonuses should feed that refresh step
 * rather than making React or content calculate combat math directly.
 */
export interface Stats extends Component {
  readonly type: "Stats";
  /** Total value stored in copper coins; UI can format it into larger units. */
  currency: number;
  resources: StatResources;
  attributes: CoreAttributes;
  combat: CombatStats;
  skills: CharacterSkills;
  progression: CharacterProgression;
  conditions: CharacterCondition[];
}
