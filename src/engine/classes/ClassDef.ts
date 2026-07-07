import type { CoreAttributes } from "../components/Stats";

export type AttributeGrowth = Partial<Record<keyof CoreAttributes, number>>;

export type EquipmentWeaponType = "sword" | "hammer" | "bow" | "staff";

export type EquipmentArmorSlot =
  | "offHand"
  | "head"
  | "body"
  | "hands"
  | "feet"
  | "accessory";

export interface ClassGrowthEntry {
  /** Character class level reached by this repeated growth-cycle entry. */
  level: number;
  attributes: AttributeGrowth;
}

export interface ClassEquipmentPermissions {
  allowedWeaponTypes: EquipmentWeaponType[];
  allowedArmorSlots: EquipmentArmorSlot[];
}

export interface ClassDef {
  classId: string;
  name: string;
  description: string;
  equipmentPermissions: ClassEquipmentPermissions;
  growthCycle: ClassGrowthEntry[];
}

export type ClassDefMap = Record<string, ClassDef>;
