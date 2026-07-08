import { describe, expect, it } from "vitest";
import type { Inventory } from "../components";
import { createInitialStats } from "../stats/characterStats";
import { getCombatPatternOptions } from "./qtePatternCombat";

function inventory(input: {
  equippedWeapon?: string;
} = {}): Inventory {
  return {
    type: "Inventory",
    items: [],
    equipped: input.equippedWeapon ? { weapon: input.equippedWeapon } : {},
  };
}

describe("qtePatternCombat", () => {
  it("lists known magical patterns for Cast", () => {
    const stats = createInitialStats();
    stats.resources.mp = 50;

    expect(
      getCombatPatternOptions({
        actionKind: "cast",
        knownPatterns: { fireball: { timesUsed: 0 } },
        inventory: inventory(),
        playerStats: stats,
      }).map((option) => option.pattern.patternId),
    ).toEqual(["fireball"]);
  });

  it("requires matching weapons for physical patterns", () => {
    const stats = createInitialStats();
    stats.resources.mp = 50;

    expect(
      getCombatPatternOptions({
        actionKind: "strike",
        knownPatterns: { crosscut: { timesUsed: 0 } },
        inventory: inventory(),
        playerStats: stats,
      }),
    ).toEqual([]);

    expect(
      getCombatPatternOptions({
        actionKind: "strike",
        knownPatterns: { crosscut: { timesUsed: 0 } },
        inventory: inventory({ equippedWeapon: "rusty_sword" }),
        playerStats: stats,
      }).map((option) => option.pattern.patternId),
    ).toEqual(["crosscut"]);
  });

  it("marks known patterns disabled when MP is too low", () => {
    const stats = createInitialStats();
    stats.resources.mp = 0;

    expect(
      getCombatPatternOptions({
        actionKind: "cast",
        knownPatterns: { fireball: { timesUsed: 0 } },
        inventory: inventory(),
        playerStats: stats,
      }),
    ).toEqual([
      expect.objectContaining({
        disabled: true,
        availabilityNote: "Not enough MP.",
      }),
    ]);
  });
});
