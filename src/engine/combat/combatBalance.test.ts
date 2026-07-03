import { describe, expect, it } from "vitest";
import type { Stats } from "../components";
import { cloneStats, createInitialStats } from "../stats/characterStats";
import { createNpcStats } from "../stats/npcStats";
import {
  createQteChallenge,
  resolveQteContest,
  type CombatActionKind,
} from "./qteCombat";

interface HitCountInput {
  attacker: Stats;
  defender: Stats;
  kind: CombatActionKind;
  inputAdvantage: number;
}

function countSuccessfulHitsToDefeat({
  attacker,
  defender,
  kind,
  inputAdvantage,
}: HitCountInput): number {
  const target = cloneStats(defender);
  let hitCount = 0;

  while (target.resources.hp > 0 && hitCount < 20) {
    const result = resolveQteContest({
      attacker,
      defender: target,
      kind,
      attackerCompleted: true,
      inputAdvantage,
    });

    target.resources.hp = Math.max(0, target.resources.hp - result.damage);
    hitCount += 1;
  }

  return hitCount;
}

describe("combat balance guardrails", () => {
  it("lets an average player defeat the tutorial slime in a few successful attacks", () => {
    const hitCount = countSuccessfulHitsToDefeat({
      attacker: createInitialStats(),
      defender: createNpcStats("slime"),
      kind: "physical",
      inputAdvantage: 2,
    });

    expect(hitCount).toBeGreaterThanOrEqual(2);
    expect(hitCount).toBeLessThanOrEqual(4);
  });

  it("lets a strong player defeat the kobold without a long equal-stat slog", () => {
    const hitCount = countSuccessfulHitsToDefeat({
      attacker: createInitialStats(),
      defender: createNpcStats("kobold"),
      kind: "physical",
      inputAdvantage: 5,
    });

    expect(hitCount).toBeGreaterThanOrEqual(4);
    expect(hitCount).toBeLessThanOrEqual(5);
  });

  it("keeps the kobold feasible but slower for an average QTE lead", () => {
    const hitCount = countSuccessfulHitsToDefeat({
      attacker: createInitialStats(),
      defender: createNpcStats("kobold"),
      kind: "physical",
      inputAdvantage: 2,
    });

    expect(hitCount).toBeGreaterThanOrEqual(6);
    expect(hitCount).toBeLessThanOrEqual(8);
  });

  it("makes the kobold pressure physical QTEs more than the tutorial slime", () => {
    const player = createInitialStats();
    const slimeChallenge = createQteChallenge({
      actor: player,
      opponent: createNpcStats("slime"),
      kind: "physical",
      isPlayerActor: true,
    });
    const koboldChallenge = createQteChallenge({
      actor: player,
      opponent: createNpcStats("kobold"),
      kind: "physical",
      isPlayerActor: true,
    });

    expect(koboldChallenge.sequenceLength).toBeGreaterThan(
      slimeChallenge.sequenceLength,
    );
    expect(koboldChallenge.timeLimitMs).toBeLessThan(
      slimeChallenge.timeLimitMs,
    );
  });

  it("keeps the kobold threatening without one-shotting a fresh player", () => {
    const player = createInitialStats();
    const kobold = createNpcStats("kobold");
    const result = resolveQteContest({
      attacker: kobold,
      defender: player,
      kind: "physical",
      attackerCompleted: true,
      inputAdvantage: 5,
    });

    expect(result.outcome).toBe("critical");
    expect(result.damage).toBeGreaterThanOrEqual(
      Math.floor(player.resources.maxHp / 8),
    );
    expect(result.damage).toBeLessThan(player.resources.hp);
  });
});
