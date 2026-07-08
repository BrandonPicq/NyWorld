import { describe, expect, it } from "vitest";
import type { EquipmentDef } from "../items/ItemDef";
import { getItemDef } from "../items/itemRegistry";
import {
  classifyTimingPress,
  computeMashTargetPresses,
  computeTimingWindows,
  mapTimingVolley,
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
