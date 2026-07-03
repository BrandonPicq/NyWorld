import { describe, expect, it } from "vitest";
import type { CharacterSkills, CombatStats, CoreAttributes } from "../components";
import { createInitialStats, refreshDerivedStats } from "../stats/characterStats";
import { createQteChallenge, resolveQteContest } from "./qteCombat";

type StatsPatch = {
  attributes?: Partial<CoreAttributes>;
  skills?: Partial<CharacterSkills>;
  combat?: Partial<CombatStats>;
};

function createStatsWith(patch: StatsPatch = {}) {
  const stats = createInitialStats();

  Object.assign(stats.attributes, patch.attributes);
  Object.assign(stats.skills, patch.skills);
  Object.assign(stats.combat, patch.combat);
  refreshDerivedStats(stats);

  if (patch.combat) {
    Object.assign(stats.combat, patch.combat);
  }

  return stats;
}

describe("qteCombat", () => {
  it("reduces physical QTE difficulty when the actor has higher agility", () => {
    const fastActor = createStatsWith({ attributes: { agility: 18 } });
    const defender = createStatsWith({ attributes: { agility: 8 } });

    const challenge = createQteChallenge({
      actor: fastActor,
      opponent: defender,
      kind: "physical",
    });

    expect(challenge.sequenceLength).toBeLessThan(5);
    expect(challenge.timeLimitMs).toBeGreaterThan(3000);
  });

  it("reduces magical QTE difficulty when the actor has higher spirit", () => {
    const focusedCaster = createStatsWith({ attributes: { spirit: 18 } });
    const defender = createStatsWith({ attributes: { spirit: 8 } });

    const challenge = createQteChallenge({
      actor: focusedCaster,
      opponent: defender,
      kind: "magical",
    });

    expect(challenge.sequenceLength).toBeLessThan(5);
    expect(challenge.timeLimitMs).toBeGreaterThan(3000);
  });

  it("increases offensive result when the attacker has a large QTE lead", () => {
    const attacker = createStatsWith({ combat: { attack: 4 } });
    const defender = createStatsWith({ combat: { defense: 2 } });

    const narrowHit = resolveQteContest({
      attacker,
      defender,
      kind: "physical",
      attackerCompleted: true,
      inputAdvantage: 1,
    });
    const criticalHit = resolveQteContest({
      attacker,
      defender,
      kind: "physical",
      attackerCompleted: true,
      inputAdvantage: 5,
    });

    expect(narrowHit).toMatchObject({ outcome: "hit", damage: 2 });
    expect(criticalHit).toMatchObject({ outcome: "critical", damage: 4 });
  });

  it("lets a strong defensive lead evade all damage", () => {
    const attacker = createStatsWith({ combat: { attack: 4 } });
    const defender = createStatsWith({ combat: { defense: 2 } });

    expect(
      resolveQteContest({
        attacker,
        defender,
        kind: "physical",
        attackerCompleted: false,
        inputAdvantage: -4,
      }),
    ).toMatchObject({ outcome: "evaded", damage: 0 });
  });

  it("lets excellent QTE execution pierce superior defense", () => {
    const attacker = createStatsWith({ combat: { attack: 1 } });
    const defender = createStatsWith({ combat: { defense: 4 } });

    expect(
      resolveQteContest({
        attacker,
        defender,
        kind: "physical",
        attackerCompleted: true,
        inputAdvantage: 6,
      }),
    ).toMatchObject({ outcome: "critical", damage: 2 });
  });
});
