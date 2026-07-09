import type { Stats } from "../components";
import type { CombatActionDef, CombatActionId } from "./CombatActionDef";
import {
  estimateCombatDamageBand,
  SEQUENCE_BALANCE_PROFILES,
  type CombatDamageBand,
} from "./combatBalanceModel";
import type { CombatActionKind } from "./qteCombat";

export interface CombatActionTooltipSummary {
  damage: string;
  cost: string;
  attackType: "Physical" | "Magical" | "None";
  additionalEffectCodes: string[];
}

export interface CombatActionTooltipSummaryInput {
  action: CombatActionDef;
  attacker: Stats;
  defender: Stats;
}

export function summarizeCombatActionForTooltip({
  action,
  attacker,
  defender,
}: CombatActionTooltipSummaryInput): CombatActionTooltipSummary {
  const attackKind = getCombatActionAttackKind(action.actionId);
  const damage =
    attackKind === undefined
      ? "None"
      : formatDamageBand(
          estimateCombatDamageBand({
            attacker,
            defender,
            kind: attackKind,
            profile: SEQUENCE_BALANCE_PROFILES.average,
          }),
        );

  return {
    damage,
    cost: formatCombatActionCost(action),
    attackType: attackKind ? formatAttackType(attackKind) : "None",
    additionalEffectCodes: getAdditionalEffectCodes(action),
  };
}

function getCombatActionAttackKind(
  actionId: CombatActionId,
): CombatActionKind | undefined {
  if (actionId === "strike") return "physical";
  if (actionId === "cast") return "magical";
  return undefined;
}

function formatDamageBand(band: CombatDamageBand): string {
  if (band.maximumDamage <= 0) return "0";
  if (band.minimumDamage === band.maximumDamage) {
    return `${band.minimumDamage}`;
  }
  return `${band.minimumDamage}-${band.maximumDamage}`;
}

function formatCombatActionCost(action: CombatActionDef): string {
  const mpCost = action.tuning?.mpCost;
  if (mpCost !== undefined) {
    return `${mpCost} MP`;
  }
  return "None";
}

function formatAttackType(kind: CombatActionKind): "Physical" | "Magical" {
  return kind === "physical" ? "Physical" : "Magical";
}

function getAdditionalEffectCodes(_action: CombatActionDef): string[] {
  return [];
}
