import { describe, expect, it } from "vitest";
import { resolveEquipmentSlotMove } from "./equipmentSlotNavigation";

describe("equipment slot navigation", () => {
  it("moves between adjacent body-layout slots", () => {
    expect(resolveEquipmentSlotMove("body", "ArrowUp")).toBe("head");
    expect(resolveEquipmentSlotMove("body", "ArrowLeft")).toBe("accessory1");
    expect(resolveEquipmentSlotMove("body", "ArrowRight")).toBe("accessory2");
    expect(resolveEquipmentSlotMove("body", "ArrowDown")).toBe("hands");
  });

  it("skips empty visual cells while moving vertically", () => {
    expect(resolveEquipmentSlotMove("weapon", "ArrowUp")).toBe("accessory1");
    expect(resolveEquipmentSlotMove("weapon", "ArrowDown")).toBeNull();
    expect(resolveEquipmentSlotMove("feet", "ArrowUp")).toBe("hands");
  });

  it("returns null for non-navigation keys and outer edges", () => {
    expect(resolveEquipmentSlotMove("head", "Enter")).toBeNull();
    expect(resolveEquipmentSlotMove("head", "ArrowUp")).toBeNull();
    expect(resolveEquipmentSlotMove("accessory2", "ArrowRight")).toBeNull();
  });
});
