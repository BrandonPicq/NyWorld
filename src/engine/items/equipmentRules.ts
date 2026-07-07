import type { ClassEquipmentPermissions } from "../classes/ClassDef";
import type { EquippedSlot } from "../components/Inventory";
import type { EquipmentDef, EquipmentSlot } from "./ItemDef";

/**
 * Whether an equipment piece fits a given equipped slot.
 *
 * The two accessory slots both accept "accessory" gear; every other slot
 * matches its equipment slot one-to-one.
 */
function equipmentFitsSlot(
  equipmentSlot: EquipmentSlot,
  slot: EquippedSlot,
): boolean {
  if (slot === "accessory1" || slot === "accessory2") {
    return equipmentSlot === "accessory";
  }
  return equipmentSlot === slot;
}

/**
 * Whether a class's permissions allow equipping this piece: weapons are gated
 * by weapon type, everything else by armor slot.
 */
function classPermitsEquipment(
  equipment: EquipmentDef,
  permissions: ClassEquipmentPermissions,
): boolean {
  return equipment.slot === "weapon"
    ? Boolean(
        equipment.weaponType &&
          permissions.allowedWeaponTypes.includes(equipment.weaponType),
      )
    : permissions.allowedArmorSlots.includes(equipment.slot);
}

/**
 * Single authority for whether an equipment piece can go into a given slot
 * under a class's permissions: the slot must accept the piece AND the class
 * must allow it. Shared by the engine's equip command and the sheet's equip
 * picker so the two never drift.
 */
export function canEquipInSlot(
  equipment: EquipmentDef,
  slot: EquippedSlot,
  permissions: ClassEquipmentPermissions,
): boolean {
  return (
    equipmentFitsSlot(equipment.slot, slot) &&
    classPermitsEquipment(equipment, permissions)
  );
}
