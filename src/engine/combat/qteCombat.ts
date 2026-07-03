import type { Stats } from "../components";

export type CombatActionKind = "physical" | "magical";
export type QteContestOutcome = "critical" | "hit" | "guarded" | "evaded";

export interface QteChallenge {
  sequenceLength: number;
  playerSequenceLength: number;
  opponentSequenceLength: number;
  timeLimitMs: number;
  actorSpeed: number;
  opponentSpeed: number;
}

export interface QteChallengeInput {
  actor: Stats;
  opponent: Stats;
  kind: CombatActionKind;
  isPlayerActor?: boolean;
  baseSequenceLength?: number;
  baseTimeLimitMs?: number;
}

export interface QteContestInput {
  attacker: Stats;
  defender: Stats;
  kind: CombatActionKind;
  attackerCompleted: boolean;
  inputAdvantage: number;
}

export interface QteContestResult {
  outcome: QteContestOutcome;
  damage: number;
  attackPower: number;
  defensePower: number;
  inputAdvantage: number;
}

export function createQteChallenge({
  actor,
  opponent,
  kind,
  isPlayerActor = true,
  baseSequenceLength = 5,
  baseTimeLimitMs = 5000,
}: QteChallengeInput): QteChallenge {
  const actorSpeed = getQteSpeed(actor, kind);
  const opponentSpeed = getQteSpeed(opponent, kind);
  const playerSpeed = isPlayerActor ? actorSpeed : opponentSpeed;
  const enemySpeed = isPlayerActor ? opponentSpeed : actorSpeed;
  const speedAdvantage = playerSpeed - enemySpeed;

  const playerSequenceLength = clamp(baseSequenceLength - Math.trunc(speedAdvantage / 5), 3, 10);
  const opponentSequenceLength = clamp(baseSequenceLength - Math.trunc(-speedAdvantage / 5), 3, 10);

  return {
    actorSpeed,
    opponentSpeed,
    sequenceLength: playerSequenceLength,
    playerSequenceLength,
    opponentSequenceLength,
    timeLimitMs: clamp(baseTimeLimitMs + speedAdvantage * 100, 3000, 8000),
  };
}

export function resolveQteContest({
  attacker,
  defender,
  kind,
  attackerCompleted,
  inputAdvantage,
}: QteContestInput): QteContestResult {
  const attackPower = getAttackPower(attacker, kind);
  const defensePower = getDefensePower(defender, kind);

  if (!attackerCompleted || inputAdvantage < 0) {
    const defenderLead = Math.abs(inputAdvantage);
    const outcome: QteContestOutcome = defenderLead >= 4 ? "evaded" : "guarded";
    return {
      outcome,
      damage: outcome === "evaded" ? 0 : Math.max(1, Math.floor(attackPower / 4)),
      attackPower,
      defensePower,
      inputAdvantage,
    };
  }

  const defenseReduction = Math.floor(inputAdvantage / 2);
  const effectiveDefense = Math.max(0, defensePower - defenseReduction);
  const baseDamage = calculateMitigatedDamage(attackPower, effectiveDefense);

  if (inputAdvantage >= 5) {
    return {
      outcome: "critical",
      damage: Math.max(
        2,
        baseDamage + Math.max(1, Math.floor(attackPower * 0.5)),
      ),
      attackPower,
      defensePower,
      inputAdvantage,
    };
  }

  return {
    outcome: "hit",
    damage: baseDamage,
    attackPower,
    defensePower,
    inputAdvantage,
  };
}

function getQteSpeed(stats: Stats, kind: CombatActionKind): number {
  return kind === "physical" ? stats.attributes.agility : stats.attributes.spirit;
}

function getAttackPower(stats: Stats, kind: CombatActionKind): number {
  return kind === "physical" ? stats.combat.attack : stats.combat.magicAttack;
}

function getDefensePower(stats: Stats, kind: CombatActionKind): number {
  return kind === "physical" ? stats.combat.defense : stats.combat.magicDefense;
}

function calculateMitigatedDamage(
  attackPower: number,
  effectiveDefense: number,
): number {
  const denominator = Math.max(1, attackPower + effectiveDefense);
  return Math.max(1, Math.floor((attackPower * attackPower) / denominator));
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
