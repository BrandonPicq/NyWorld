import {
  getClassDef,
  getItemDef,
  type EquippedSlot,
  type InventoryStack,
} from "../../../engine";

/**
 * Filters the player's inventory to find items that can be equipped in the specified
 * slot under the active class's equipment permissions.
 */
export function getEquippableItemsForSlot(
  items: InventoryStack[],
  slot: EquippedSlot,
  classId: string
): InventoryStack[] {
  const classDef = getClassDef(classId);
  if (!classDef) return [];

  const permissions = classDef.equipmentPermissions;

  return items.filter((stack) => {
    const itemDef = getItemDef(stack.itemId);
    if (!itemDef || itemDef.category !== "equipment" || !itemDef.equipment) {
      return false;
    }

    const equipment = itemDef.equipment;

    // 1. Verify equipment slot match
    if (slot === "weapon") {
      if (equipment.slot !== "weapon") return false;
    } else if (slot === "accessory1" || slot === "accessory2") {
      if (equipment.slot !== "accessory") return false;
    } else {
      if (equipment.slot !== slot) return false;
    }

    // 2. Verify class permissions
    const canEquip =
      equipment.slot === "weapon"
        ? Boolean(
            equipment.weaponType &&
              permissions.allowedWeaponTypes.includes(equipment.weaponType)
          )
        : permissions.allowedArmorSlots.includes(equipment.slot);

    return canEquip;
  });
}
