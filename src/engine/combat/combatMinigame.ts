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
export type CombatMinigameSpec = SequenceMinigameSpec;

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
  }
}
