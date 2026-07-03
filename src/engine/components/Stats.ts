import type { Component } from "../ecs/types";

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

export interface CombatStats {
  attack: number;
  magicAttack: number;
  defense: number;
  magicDefense: number;
}

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

export interface CharacterProgression {
  academicTitle: string;
  academicProgress: number;
}

export interface CharacterCondition {
  id: string;
  name: string;
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
  /** Total value stored in bronze coins; UI can format it into larger units. */
  currency: number;
  resources: StatResources;
  attributes: CoreAttributes;
  combat: CombatStats;
  skills: CharacterSkills;
  progression: CharacterProgression;
  conditions: CharacterCondition[];
}
