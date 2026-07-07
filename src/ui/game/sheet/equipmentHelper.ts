import {
  canEquipInSlot,
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

    return canEquipInSlot(itemDef.equipment, slot, permissions);
  });
}
