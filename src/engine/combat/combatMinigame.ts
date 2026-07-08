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
export type CombatMinigameSpec = SequenceMinigameSpec | MashMinigameSpec;

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
 * Default minigame per weapon archetype (ADR 0009). Bow becomes `timing` in a
 * later slice; it stays a sequence race until then.
 */
export const WEAPON_ARCHETYPE_MINIGAME: Record<
  EquipmentWeaponType,
  EquipmentMinigameType
> = {
  sword: "sequence",
  hammer: "mash",
  bow: "sequence",
  staff: "sequence",
};

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
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
