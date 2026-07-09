import { describe, expect, it } from "vitest";
import type { EquipmentDef } from "../items/ItemDef";
import { getItemDef } from "../items/itemRegistry";
import {
  classifyTimingPress,
  computeMashTargetPresses,
  computeMasteryDelta,
  computeTimingWindowCenter,
  computeTimingWindowTravelSpeed,
  computeTimingWindows,
  mapTimingVolley,
  modulateMashTarget,
  modulateSequenceLength,
  modulateSequenceTimeLimit,
  modulateTimingSweep,
  resolveWeaponMinigameType,
} from "./combatMinigame";

function weapon(overrides: Partial<EquipmentDef>): EquipmentDef {
  return {
    slot: "weapon",
    weaponType: "sword",
    bonuses: { "combat.attack": 1 },
    ...overrides,
  };
}

describe("resolveWeaponMinigameType", () => {
  it("uses the archetype default for each weapon type", () => {
    expect(resolveWeaponMinigameType(weapon({ weaponType: "sword" }))).toBe(
      "sequence",
    );
    expect(resolveWeaponMinigameType(weapon({ weaponType: "hammer" }))).toBe(
      "mash",
    );
    expect(resolveWeaponMinigameType(weapon({ weaponType: "bow" }))).toBe(
      "timing",
    );
    expect(resolveWeaponMinigameType(weapon({ weaponType: "staff" }))).toBe(
      "sequence",
    );
  });

  it("lets an authored override win over the archetype default", () => {
    expect(
      resolveWeaponMinigameType(
        weapon({ weaponType: "hammer", minigame: "sequence" }),
      ),
    ).toBe("sequence");
    expect(
      resolveWeaponMinigameType(
        weapon({ weaponType: "sword", minigame: "mash" }),
      ),
    ).toBe("mash");
  });

  it("falls back to sequence for unarmed and non-weapon equipment", () => {
    expect(resolveWeaponMinigameType(undefined)).toBe("sequence");
    expect(
      resolveWeaponMinigameType({ slot: "body", bonuses: { "combat.defense": 1 } }),
    ).toBe("sequence");
  });

  it("matches the shipped tier-0 weapons", () => {
    expect(resolveWeaponMinigameType(getItemDef("rusty_sword").equipment)).toBe(
      "sequence",
    );
    expect(resolveWeaponMinigameType(getItemDef("stone_hammer").equipment)).toBe(
      "mash",
    );
    expect(resolveWeaponMinigameType(getItemDef("novice_staff").equipment)).toBe(
      "sequence",
    );
    expect(resolveWeaponMinigameType(getItemDef("training_bow").equipment)).toBe(
      "timing",
    );
  });

  it("ships at least one weapon above the starting mastery recommendation", () => {
    expect(getItemDef("hunter_bow").equipment).toMatchObject({
      slot: "weapon",
      weaponType: "bow",
      recommendedMasteryLevel: 2,
    });
  });
});

describe("computeMashTargetPresses", () => {
  it("returns the base target at no speed advantage", () => {
    expect(computeMashTargetPresses(0)).toBe(12);
  });

  it("eases the target when the player is faster", () => {
    // trunc(6/5)=1 -> 12 - 2 = 10
    expect(computeMashTargetPresses(6)).toBe(10);
    // trunc(12/5)=2 -> 12 - 4 = 8
    expect(computeMashTargetPresses(12)).toBe(8);
  });

  it("raises the target when the player is slower", () => {
    // trunc(-6/5)=-1 -> 12 - (-2) = 14
    expect(computeMashTargetPresses(-6)).toBe(14);
  });

  it("clamps to the 6..20 range", () => {
    expect(computeMashTargetPresses(100)).toBe(6);
    expect(computeMashTargetPresses(-100)).toBe(20);
  });
});

describe("weapon mastery modulation", () => {
  it("clamps the mastery delta to -3..+3", () => {
    expect(computeMasteryDelta(5, 5)).toBe(0);
    expect(computeMasteryDelta(7, 5)).toBe(2);
    expect(computeMasteryDelta(2, 5)).toBe(-3);
    expect(computeMasteryDelta(20, 0)).toBe(3);
  });

  it("shifts the sequence time limit by 300 ms per point", () => {
    expect(modulateSequenceTimeLimit(5000, 0)).toBe(5000);
    expect(modulateSequenceTimeLimit(5000, 3)).toBe(5900);
    expect(modulateSequenceTimeLimit(5000, -2)).toBe(4400);
  });

  it("changes the sequence length only at |delta| >= 2", () => {
    expect(modulateSequenceLength(5, 1)).toBe(5);
    expect(modulateSequenceLength(5, -1)).toBe(5);
    expect(modulateSequenceLength(5, 2)).toBe(4);
    expect(modulateSequenceLength(5, -2)).toBe(6);
    expect(modulateSequenceLength(1, 3)).toBe(1);
  });

  it("eases the mash target by one press per point, floored at 4", () => {
    expect(modulateMashTarget(10, 0)).toBe(10);
    expect(modulateMashTarget(10, 3)).toBe(7);
    expect(modulateMashTarget(10, -2)).toBe(12);
    expect(modulateMashTarget(5, 3)).toBe(4);
  });

  it("scales the timing sweep by 10 % per point, clamped to +/-30 %", () => {
    expect(modulateTimingSweep(1200, 0)).toBe(1200);
    expect(modulateTimingSweep(1200, 2)).toBeCloseTo(1440, 6);
    expect(modulateTimingSweep(1200, -1)).toBeCloseTo(1080, 6);
    // +5 points would be +50 %, clamped to +30 %
    expect(modulateTimingSweep(1200, 5)).toBeCloseTo(1560, 6);
    expect(modulateTimingSweep(1200, -5)).toBeCloseTo(840, 6);
  });
});

describe("computeTimingWindows", () => {
  it("returns the base windows at no agility gap", () => {
    expect(computeTimingWindows(0)).toEqual({
      greatWindow: 0.26,
      criticalWindow: 0.08,
    });
  });

  it("widens the windows with a positive agility gap", () => {
    const { greatWindow, criticalWindow } = computeTimingWindows(5);
    expect(greatWindow).toBeCloseTo(0.36, 10);
    expect(criticalWindow).toBeCloseTo(0.13, 10);
  });

  it("clamps both windows at the extremes", () => {
    expect(computeTimingWindows(100)).toEqual({
      greatWindow: 0.4,
      criticalWindow: 0.16,
    });
    expect(computeTimingWindows(-100)).toEqual({
      greatWindow: 0.14,
      criticalWindow: 0.04,
    });
  });
});

describe("computeTimingWindowTravelSpeed", () => {
  it("keeps the timing window static when the player matches or beats agility", () => {
    expect(computeTimingWindowTravelSpeed(0)).toBe(0);
    expect(computeTimingWindowTravelSpeed(3)).toBe(0);
  });

  it("moves the timing window faster as the agility deficit grows", () => {
    expect(computeTimingWindowTravelSpeed(-1)).toBeCloseTo(0.12, 10);
    expect(computeTimingWindowTravelSpeed(-4)).toBeCloseTo(0.27, 10);
  });

  it("caps the timing window movement speed", () => {
    expect(computeTimingWindowTravelSpeed(-100)).toBeCloseTo(0.42, 10);
  });
});

describe("computeTimingWindowCenter", () => {
  it("keeps the window centered when movement is disabled", () => {
    expect(computeTimingWindowCenter(600, 0, 0.26)).toBe(0.5);
  });

  it("bounces the moving window while keeping the great window visible", () => {
    expect(computeTimingWindowCenter(0, 0.2, 0.2)).toBeCloseTo(0.1, 10);
    expect(computeTimingWindowCenter(2000, 0.2, 0.2)).toBeCloseTo(0.5, 10);
    expect(computeTimingWindowCenter(4000, 0.2, 0.2)).toBeCloseTo(0.9, 10);
    expect(computeTimingWindowCenter(6000, 0.2, 0.2)).toBeCloseTo(0.5, 10);
  });
});

describe("classifyTimingPress", () => {
  const great = 0.4;
  const critical = 0.1;

  it("scores a centered press as critical", () => {
    expect(classifyTimingPress(0.5, great, critical)).toBe("critical");
    expect(classifyTimingPress(0.54, great, critical)).toBe("critical");
  });

  it("scores a press inside great but outside critical", () => {
    expect(classifyTimingPress(0.6, great, critical)).toBe("great");
    expect(classifyTimingPress(0.4, great, critical)).toBe("great");
  });

  it("scores a press outside the great window as a rate", () => {
    expect(classifyTimingPress(0.1, great, critical)).toBe("rate");
    expect(classifyTimingPress(0.9, great, critical)).toBe("rate");
  });

  it("scores against a moving window center", () => {
    expect(classifyTimingPress(0.2, great, critical, 0.2)).toBe("critical");
    expect(classifyTimingPress(0.3, great, critical, 0.2)).toBe("great");
    expect(classifyTimingPress(0.5, great, critical, 0.2)).toBe("rate");
  });
});

describe("mapTimingVolley", () => {
  it("sums shot values into the input advantage", () => {
    // 3 criticals -> +6 (critical outcome once resolved)
    expect(mapTimingVolley(["critical", "critical", "critical"])).toEqual({
      completed: true,
      inputAdvantage: 6,
      mistakes: 0,
    });
    // 3 greats -> +3
    expect(mapTimingVolley(["great", "great", "great"])).toEqual({
      completed: true,
      inputAdvantage: 3,
      mistakes: 0,
    });
  });

  it("marks the volley incomplete only when every shot missed", () => {
    expect(mapTimingVolley(["rate", "rate", "rate"])).toEqual({
      completed: false,
      inputAdvantage: -6,
      mistakes: 0,
    });
    expect(mapTimingVolley(["rate", "great", "rate"])).toEqual({
      completed: true,
      inputAdvantage: -3,
      mistakes: 0,
    });
  });
});
