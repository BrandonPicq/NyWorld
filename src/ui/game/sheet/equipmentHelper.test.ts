import { describe, expect, it } from "vitest";
import { getEquippableItemsForSlot } from "./equipmentHelper";
import type { InventoryStack, EquippedSlot } from "../../../engine";

describe("equipmentHelper - getEquippableItemsForSlot", () => {
  it("filters items by slot type and class permissions", () => {
    const items: InventoryStack[] = [
      { itemId: "rusty_sword", quantity: 1 }, // sword weapon
      { itemId: "wooden_shield", quantity: 1 }, // offHand armor
      { itemId: "copper_ring", quantity: 1 }, // accessory
      { itemId: "healing_herb", quantity: 5 }, // consumable
    ];

    // Otherworlder class permissions allow all 4 weapon types and accessory
    const equippableWeapons = getEquippableItemsForSlot(items, "weapon", "otherworlder");
    expect(equippableWeapons.map((s) => s.itemId)).toContain("rusty_sword");
    expect(equippableWeapons.map((s) => s.itemId)).not.toContain("wooden_shield");
    expect(equippableWeapons.map((s) => s.itemId)).not.toContain("healing_herb");

    const equippableOffHand = getEquippableItemsForSlot(items, "offHand", "otherworlder");
    expect(equippableOffHand.map((s) => s.itemId)).toContain("wooden_shield");

    const equippableAcc1 = getEquippableItemsForSlot(items, "accessory1", "otherworlder");
    expect(equippableAcc1.map((s) => s.itemId)).toContain("copper_ring");

    const equippableAcc2 = getEquippableItemsForSlot(items, "accessory2", "otherworlder");
    expect(equippableAcc2.map((s) => s.itemId)).toContain("copper_ring");
  });
});
