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

/**
 * Authored definition for one combat menu action.
 *
 * The engine recognizes a fixed set of action ids; content owns the
 * player-facing texts and the tuning numbers. The prose effects strings
 * currently repeat the tuning values, so keep both in sync when rebalancing.
 */
export interface CombatActionDef {
  /** One of the engine-known action ids; new ids require engine support. */
  actionId: CombatActionId;
  /** Menu label. */
  name: string;
  /** Broad grouping used for menu presentation. */
  category: CombatActionCategory;
  /** Menu position; lower comes first, duplicates trigger a warning. */
  order: number;
  /** One-line tooltip shown on selection. */
  summary: string;
  /** Human-readable damage/resolution formula shown in the details popup. */
  formula: string;
  /** Short effect bullet points shown in the details popup. */
  effects: string[];
  /** Longer explanation paragraphs shown in the details popup. */
  details: string[];
  /** Optional authored tuning values consumed by the combat system. */
  tuning?: CombatActionTuning;
}

export type CombatActionDefMap = Record<CombatActionId, CombatActionDef>;
