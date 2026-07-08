import type { EquipmentWeaponType } from "../classes/ClassDef";
import type { EquipmentDef, EquipmentMinigameType } from "../items/ItemDef";
import type { QteChallenge } from "./qteCombat";

/**
 * Engine-owned description of the real-time input challenge the UI must run
 * for the active combat turn.
 *
 * Every minigame varies only the INPUT challenge; the resolved
 * `{completed, inputAdvantage, mistakes}` still flows through
 * `resolveQteContest`, which stays the single damage authority (ADR 0009).
 * React renders a spec and collects input, it never decides which minigame
 * runs.
 */
export type CombatMinigameSpec =
  | SequenceMinigameSpec
  | MashMinigameSpec
  | TimingMinigameSpec;

/**
 * The original arrow-key sequence race: the acting side types an ordered
 * arrow sequence against a time limit while the opponent races in parallel.
 */
export interface SequenceMinigameSpec {
  kind: "sequence";
  /** Timing/length parameters derived from both actors' speed. */
  challenge: QteChallenge;
  /** Ordered arrow-key sequence the player must type. */
  sequence: string[];
}

/**
 * The hammer mash: the acting side hammers ONE randomly-drawn arrow until it
 * reaches the target press count. The opponent races with the same rhythm as
 * the sequence mechanic; pressing any other arrow is a mistake.
 */
export interface MashMinigameSpec {
  kind: "mash";
  /** Opponent race params + time limit, reused from the sequence challenge. */
  challenge: QteChallenge;
  /** The single arrow direction to hammer this turn. */
  arrow: string;
  /** Presses of the drawn arrow the player must reach to complete. */
  targetPresses: number;
}

/**
 * The bow timing volley: the acting side looses `volleySize` shots, each timed
 * against a cursor sweeping the gauge. Pressing while the cursor is inside the
 * great/critical window scores the shot; the outcome maps straight to the
 * QTE contest advantage (no opponent race, no mistakes).
 */
export interface TimingMinigameSpec {
  kind: "timing";
  /** Number of shots in the volley. */
  volleySize: number;
  /** Time for the cursor to sweep the whole gauge, per shot, in ms. */
  sweepMs: number;
  /** Width of the great window as a fraction of the gauge (centered). */
  greatWindow: number;
  /** Width of the critical window as a fraction of the gauge (centered). */
  criticalWindow: number;
}

/** How a single timing shot lands. */
export type TimingShotOutcome = "critical" | "great" | "rate";

/**
 * Default minigame per weapon archetype (ADR 0009).
 */
export const WEAPON_ARCHETYPE_MINIGAME: Record<
  EquipmentWeaponType,
  EquipmentMinigameType
> = {
  sword: "sequence",
  hammer: "mash",
  bow: "timing",
  staff: "sequence",
};

/** Base sweep time for one bow timing shot, in milliseconds (ADR 0009). */
export const TIMING_BASE_SWEEP_MS = 1200;

/** Default number of shots in a bow volley when the weapon omits it. */
export const DEFAULT_VOLLEY_SIZE = 3;

/**
 * Resolves the minigame mechanic for an equipped weapon: an authored override
 * wins, else the archetype default, else `sequence` for unarmed/non-weapon.
 */
export function resolveWeaponMinigameType(
  equipment: EquipmentDef | undefined,
): EquipmentMinigameType {
  if (!equipment || equipment.slot !== "weapon") {
    return "sequence";
  }
  if (equipment.minigame) {
    return equipment.minigame;
  }
  return equipment.weaponType
    ? WEAPON_ARCHETYPE_MINIGAME[equipment.weaponType]
    : "sequence";
}

/**
 * Target press count for the mash minigame: base 12, eased by the acting
 * side's speed advantage, clamped to 6..20 (ADR 0009). `speedAdvantage` is the
 * same actor-minus-opponent QTE speed used by `createQteChallenge`.
 */
export function computeMashTargetPresses(speedAdvantage: number): number {
  return clamp(12 - Math.trunc(speedAdvantage / 5) * 2, 6, 20);
}

/**
 * Weapon-mastery modulation delta: how far the wielder's mastery is above (or
 * below) the weapon's soft recommended level, clamped to -3..+3 (ADR 0009).
 * Positive eases the minigame, negative hardens it.
 */
export function computeMasteryDelta(
  masteryLevel: number,
  recommendedLevel: number,
): number {
  return clamp(masteryLevel - recommendedLevel, -3, 3);
}

/** Sequence time limit modulation: +/-300 ms per mastery delta point. */
export function modulateSequenceTimeLimit(
  baseTimeLimitMs: number,
  delta: number,
): number {
  return baseTimeLimitMs + 300 * delta;
}

/**
 * Sequence length modulation: at delta >= +2 the sequence loses one input, at
 * delta <= -2 it gains one; otherwise unchanged (ADR 0009).
 */
export function modulateSequenceLength(baseLength: number, delta: number): number {
  if (delta >= 2) {
    return Math.max(1, baseLength - 1);
  }
  if (delta <= -2) {
    return baseLength + 1;
  }
  return baseLength;
}

/** Mash target modulation: -1 press per positive delta point, floored at 4. */
export function modulateMashTarget(baseTarget: number, delta: number): number {
  return Math.max(4, baseTarget - delta);
}

/**
 * Timing sweep modulation: +10 % per positive delta point (slower, easier
 * cursor), clamped to +/-30 % (ADR 0009).
 */
export function modulateTimingSweep(baseSweepMs: number, delta: number): number {
  return baseSweepMs * clamp(1 + 0.1 * delta, 0.7, 1.3);
}

/**
 * Great/critical window widths (as gauge fractions) for the timing volley,
 * sized by the acting side's agility gap over the defender (ADR 0009). The
 * critical window is centered inside the great window.
 */
export function computeTimingWindows(agilityGap: number): {
  greatWindow: number;
  criticalWindow: number;
} {
  return {
    greatWindow: clamp(0.26 + 0.02 * agilityGap, 0.14, 0.4),
    criticalWindow: clamp(0.08 + 0.01 * agilityGap, 0.04, 0.16),
  };
}

/**
 * Classifies a timing shot by the cursor position (0..1) at press time. Both
 * windows are centered on the middle of the gauge.
 */
export function classifyTimingPress(
  position: number,
  greatWindow: number,
  criticalWindow: number,
): TimingShotOutcome {
  const distanceFromCenter = Math.abs(position - 0.5);
  if (distanceFromCenter <= criticalWindow / 2) {
    return "critical";
  }
  if (distanceFromCenter <= greatWindow / 2) {
    return "great";
  }
  return "rate";
}

/**
 * Normalizes a finished volley to the QTE contest contract: critical +2,
 * great +1, rate -2 summed into `inputAdvantage`; `completed` is true when at
 * least one shot did not miss; timing carries no mistakes (ADR 0009).
 */
export function mapTimingVolley(outcomes: TimingShotOutcome[]): {
  completed: boolean;
  inputAdvantage: number;
  mistakes: number;
} {
  const shotValue: Record<TimingShotOutcome, number> = {
    critical: 2,
    great: 1,
    rate: -2,
  };
  const inputAdvantage = outcomes.reduce(
    (sum, outcome) => sum + shotValue[outcome],
    0,
  );
  return {
    completed: outcomes.some((outcome) => outcome !== "rate"),
    inputAdvantage,
    mistakes: 0,
  };
}

/** Detached deep copy of a minigame spec, safe to expose in a snapshot. */
export function cloneCombatMinigameSpec(
  spec: CombatMinigameSpec,
): CombatMinigameSpec {
  switch (spec.kind) {
    case "sequence":
      return {
        kind: "sequence",
        challenge: { ...spec.challenge },
        sequence: [...spec.sequence],
      };
    case "mash":
      return {
        kind: "mash",
        challenge: { ...spec.challenge },
        arrow: spec.arrow,
        targetPresses: spec.targetPresses,
      };
    case "timing":
      return {
        kind: "timing",
        volleySize: spec.volleySize,
        sweepMs: spec.sweepMs,
        greatWindow: spec.greatWindow,
        criticalWindow: spec.criticalWindow,
      };
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
