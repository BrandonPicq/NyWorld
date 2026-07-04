import type { CombatActionCommand } from "../commands";

export type CombatActionId = CombatActionCommand | "use_item";

export type CombatActionCategory = "offense" | "defense" | "utility";

/**
 * Authored gameplay tuning for one combat action.
 *
 * Each action reads only the fields it supports; omitted fields fall back to
 * engine defaults so isolated tests stay self-contained.
 */
export interface CombatActionTuning {
  /** SP gained when the action is selected. */
  spGain?: number;
  /** MP spent before the action's QTE starts. */
  mpCost?: number;
  /** Multiplier applied to the next damaging player action (Focus). */
  damageBoostMultiplier?: number;
  /** Multiplier applied to the next incoming enemy damage (Guard). */
  incomingDamageMultiplier?: number;
}

export interface CombatActionDef {
  actionId: CombatActionId;
  name: string;
  category: CombatActionCategory;
  order: number;
  summary: string;
  formula: string;
  effects: string[];
  details: string[];
  /** Optional authored tuning values consumed by the combat system. */
  tuning?: CombatActionTuning;
}

export type CombatActionDefMap = Record<CombatActionId, CombatActionDef>;
