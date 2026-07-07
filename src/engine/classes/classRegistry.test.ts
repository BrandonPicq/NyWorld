import { describe, expect, it } from "vitest";

import {
  getAllClassIds,
  getClassDef,
  hasClassDef,
  validateClassDef,
} from "./classRegistry";

describe("classRegistry", () => {
  it("loads the shipped otherworlder class", () => {
    expect(getAllClassIds()).toContain("otherworlder");
    expect(hasClassDef("otherworlder")).toBe(true);

    const otherworlder = getClassDef("otherworlder");
    expect(otherworlder.equipmentPermissions.allowedWeaponTypes).toEqual([
      "sword",
      "hammer",
      "bow",
      "staff",
    ]);
    expect(otherworlder.growthCycle).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          level: 2,
          attributes: { strength: 1 },
        }),
      ]),
    );
  });

  it("returns detached class definitions", () => {
    const first = getClassDef("otherworlder");
    first.growthCycle[0].attributes.strength = 99;

    expect(getClassDef("otherworlder").growthCycle[0].attributes.strength).not.toBe(
      99,
    );
  });

  it("keeps the unknown class fallback inert", () => {
    const fallback = getClassDef("missing_class");

    expect(fallback.equipmentPermissions.allowedWeaponTypes).toEqual([]);
    expect(fallback.equipmentPermissions.allowedArmorSlots).toEqual([]);
    expect(fallback.growthCycle).toEqual([]);
  });

  it("reports invalid class growth attributes", () => {
    const diagnostics = validateClassDef({
      classId: "bad_class",
      name: "Bad Class",
      description: "Invalid.",
      equipmentPermissions: {
        allowedWeaponTypes: ["sword"],
        allowedArmorSlots: ["body"],
      },
      growthCycle: [{ level: 2, attributes: { luck: 1 } }],
    });

    expect(diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          severity: "error",
          contentType: "class",
          path: "growthCycle[0].attributes.luck",
        }),
      ]),
    );
  });
});
