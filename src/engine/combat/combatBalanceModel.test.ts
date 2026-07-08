import { describe, expect, it } from "vitest";
import { createInitialStats } from "../stats/characterStats";
import { createNpcStats } from "../stats/npcStats";
import {
  computeDamageVarianceRange,
  estimateCombatDamageBand,
  HIDDEN_PATTERN_BALANCE_PROFILES,
  SEQUENCE_BALANCE_PROFILES,
  TIMING_BALANCE_PROFILES,
} from "./combatBalanceModel";

describe("combatBalanceModel", () => {
  it("matches the production damage variance range", () => {
    expect(computeDamageVarianceRange(10)).toEqual({
      minimumDamage: 8,
      maximumDamage: 12,
    });
    expect(computeDamageVarianceRange(0)).toEqual({
      minimumDamage: 0,
      maximumDamage: 0,
    });
  });

  it("estimates average sequence damage for the tutorial target", () => {
    const band = estimateCombatDamageBand({
      attacker: createInitialStats(),
      defender: createNpcStats("slime"),
      kind: "physical",
      profile: SEQUENCE_BALANCE_PROFILES.average,
    });

    expect(band).toEqual({
      outcome: "hit",
      preVarianceDamage: 10,
      minimumDamage: 8,
      maximumDamage: 12,
    });
  });

  it("keeps strong sequence damage meaningful against the kobold", () => {
    const band = estimateCombatDamageBand({
      attacker: createInitialStats(),
      defender: createNpcStats("kobold"),
      kind: "physical",
      profile: SEQUENCE_BALANCE_PROFILES.strong,
    });

    expect(band.outcome).toBe("critical");
    expect(band.preVarianceDamage).toBe(11);
    expect(band.minimumDamage).toBe(9);
    expect(band.maximumDamage).toBe(13);
  });

  it("maps timing strong performance to a critical-range advantage", () => {
    const band = estimateCombatDamageBand({
      attacker: createInitialStats(),
      defender: createNpcStats("goblin"),
      kind: "physical",
      profile: TIMING_BALANCE_PROFILES.strong,
    });

    expect(band.outcome).toBe("critical");
    expect(band.preVarianceDamage).toBeGreaterThan(
      estimateCombatDamageBand({
        attacker: createInitialStats(),
        defender: createNpcStats("goblin"),
        kind: "physical",
        profile: TIMING_BALANCE_PROFILES.average,
      }).preVarianceDamage,
    );
  });

  it("estimates learned pattern multipliers after the QTE outcome", () => {
    const band = estimateCombatDamageBand({
      attacker: createInitialStats(),
      defender: createNpcStats("goblin"),
      kind: "magical",
      profile: HIDDEN_PATTERN_BALANCE_PROFILES.average,
      damageMultiplier: 1.6,
    });

    expect(band).toEqual({
      outcome: "hit",
      preVarianceDamage: 11,
      minimumDamage: 9,
      maximumDamage: 13,
    });
  });
});
