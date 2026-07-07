import { describe, expect, it } from "vitest";
import type { ClassEquipmentPermissions } from "../classes/ClassDef";
import type { EquipmentDef } from "./ItemDef";
import { canEquipInSlot } from "./equipmentRules";

const permissions: ClassEquipmentPermissions = {
  allowedWeaponTypes: ["sword"],
  allowedArmorSlots: ["head", "body", "accessory"],
};

const sword: EquipmentDef = {
  slot: "weapon",
  weaponType: "sword",
  bonuses: {},
};

const staff: EquipmentDef = {
  slot: "weapon",
  weaponType: "staff",
  bonuses: {},
};

const cap: EquipmentDef = { slot: "head", bonuses: {} };
const gloves: EquipmentDef = { slot: "hands", bonuses: {} };
const ring: EquipmentDef = { slot: "accessory", bonuses: {} };

describe("canEquipInSlot", () => {
  it("allows a permitted weapon into the weapon slot", () => {
    expect(canEquipInSlot(sword, "weapon", permissions)).toBe(true);
  });

  it("rejects a weapon whose type the class cannot wield", () => {
    expect(canEquipInSlot(staff, "weapon", permissions)).toBe(false);
  });

  it("rejects a weapon into a non-weapon slot", () => {
    expect(canEquipInSlot(sword, "head", permissions)).toBe(false);
  });

  it("allows armor into its matching slot when the class permits it", () => {
    expect(canEquipInSlot(cap, "head", permissions)).toBe(true);
  });

  it("rejects armor whose slot the class does not permit", () => {
    expect(canEquipInSlot(gloves, "hands", permissions)).toBe(false);
  });

  it("rejects armor placed in the wrong slot", () => {
    expect(canEquipInSlot(cap, "body", permissions)).toBe(false);
  });

  it("accepts an accessory into either accessory slot", () => {
    expect(canEquipInSlot(ring, "accessory1", permissions)).toBe(true);
    expect(canEquipInSlot(ring, "accessory2", permissions)).toBe(true);
  });

  it("rejects a weapon that has no weapon type", () => {
    const brokenWeapon: EquipmentDef = { slot: "weapon", bonuses: {} };
    expect(canEquipInSlot(brokenWeapon, "weapon", permissions)).toBe(false);
  });
});
