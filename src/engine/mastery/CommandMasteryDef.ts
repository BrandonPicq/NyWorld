export interface CommandMasteryEffects {
  damageBoost?: number;
  incomingDamageMultiplier?: number;
  mpCostReductionLevels?: number[];
  nextDamageBoost?: number;
  successChance?: number;
  itemEffectMultiplier?: number;
  xp?: number;
  energyRestore?: number;
}

export interface CommandMasteryDef {
  commandId: string;
  name: string;
  cap: number;
  usageRequired: number;
  effects: CommandMasteryEffects;
  unlocks: string[];
}

export type CommandMasteryDefMap = Record<string, CommandMasteryDef>;
