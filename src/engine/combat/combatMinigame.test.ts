import { describe, expect, it } from "vitest";
import type { EquipmentDef } from "../items/ItemDef";
import { getItemDef } from "../items/itemRegistry";
import {
  computeMashTargetPresses,
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
      "sequence",
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
