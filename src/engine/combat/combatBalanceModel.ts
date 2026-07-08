import type { Stats } from "../components";
import {
  resolveQteContest,
  type CombatActionKind,
  type QteContestOutcome,
} from "./qteCombat";

export type CombatPerformanceProfileId = "poor" | "average" | "strong";

export interface CombatPerformanceProfile {
  id: CombatPerformanceProfileId;
  label: string;
  completed: boolean;
  inputAdvantage: number;
  mistakes: number;
}

export interface CombatDamageBandInput {
  attacker: Stats;
  defender: Stats;
  kind: CombatActionKind;
  profile: CombatPerformanceProfile;
  damageMultiplier?: number;
  focusMultiplier?: number;
}

export interface CombatDamageBand {
  outcome: QteContestOutcome | "input_failure";
  preVarianceDamage: number;
  minimumDamage: number;
  maximumDamage: number;
}

export const SEQUENCE_BALANCE_PROFILES: Record<
  CombatPerformanceProfileId,
  CombatPerformanceProfile
> = {
  poor: {
    id: "poor",
    label: "Falls behind or times out",
    completed: false,
    inputAdvantage: -2,
    mistakes: 1,
  },
  average: {
    id: "average",
    label: "Completes with a small lead",
    completed: true,
    inputAdvantage: 2,
    mistakes: 0,
  },
  strong: {
    id: "strong",
    label: "Completes with a critical lead",
    completed: true,
    inputAdvantage: 5,
    mistakes: 0,
  },
};

export const MASH_BALANCE_PROFILES = SEQUENCE_BALANCE_PROFILES;

export const HIDDEN_PATTERN_BALANCE_PROFILES = SEQUENCE_BALANCE_PROFILES;

export const TIMING_BALANCE_PROFILES: Record<
  CombatPerformanceProfileId,
  CombatPerformanceProfile
> = {
  poor: {
    id: "poor",
    label: "Most shots miss",
    completed: false,
    inputAdvantage: -2,
    mistakes: 0,
  },
  average: {
    id: "average",
    label: "Three great shots or an equivalent mix",
    completed: true,
    inputAdvantage: 3,
    mistakes: 0,
  },
  strong: {
    id: "strong",
    label: "Three critical shots or an equivalent mix",
    completed: true,
    inputAdvantage: 6,
    mistakes: 0,
  },
};

export function estimateCombatDamageBand({
  attacker,
  defender,
  kind,
  profile,
  damageMultiplier = 1,
  focusMultiplier = 1,
}: CombatDamageBandInput): CombatDamageBand {
  if (profile.mistakes >= 2) {
    return {
      outcome: "input_failure",
      preVarianceDamage: 0,
      minimumDamage: 0,
      maximumDamage: 0,
    };
  }

  const result = resolveQteContest({
    attacker,
    defender,
    kind,
    attackerCompleted: profile.completed,
    inputAdvantage: profile.inputAdvantage,
  });

  let damage = result.damage;
  if (profile.mistakes === 1) {
    damage = Math.floor(damage * 0.8);
  }
  if (damage > 0) {
    damage = Math.floor(damage * damageMultiplier);
  }
  if (damage > 0) {
    damage = Math.floor(damage * focusMultiplier);
  }

  const range = computeDamageVarianceRange(damage);
  return {
    outcome: result.outcome,
    preVarianceDamage: damage,
    minimumDamage: range.minimumDamage,
    maximumDamage: range.maximumDamage,
  };
}

export function computeDamageVarianceRange(damage: number): {
  minimumDamage: number;
  maximumDamage: number;
} {
  if (damage <= 0) {
    return { minimumDamage: 0, maximumDamage: 0 };
  }

  const minimumDamage = Math.max(1, Math.ceil(damage * 0.75));
  const maximumDamage = Math.max(minimumDamage, Math.floor(damage * 1.25));
  return { minimumDamage, maximumDamage };
}
