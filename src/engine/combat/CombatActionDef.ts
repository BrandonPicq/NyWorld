import type { CombatActionCommand } from "../commands";

export type CombatActionId = CombatActionCommand | "use_item";

export type CombatActionCategory = "offense" | "defense" | "utility";

export interface CombatActionDef {
  actionId: CombatActionId;
  name: string;
  category: CombatActionCategory;
  order: number;
  summary: string;
  formula: string;
  effects: string[];
  details: string[];
}

export type CombatActionDefMap = Record<CombatActionId, CombatActionDef>;
