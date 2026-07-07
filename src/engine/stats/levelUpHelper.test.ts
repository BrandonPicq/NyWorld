import { describe, expect, it } from "vitest";
import { getGlobalLevelUpMessage, getClassLevelUpMessage } from "./levelUpHelper";
import { getRaceDef } from "../races/raceRegistry";
import { getClassDef } from "../classes/classRegistry";

describe("levelUpHelper", () => {
  it("formats global level up message correctly", () => {
    const raceDef = getRaceDef("human");
    // Level 3 should have: perception +1, charisma +1 (for human growth multipliers: both are 1x)
    const msg = getGlobalLevelUpMessage(3, raceDef);
    expect(msg).toBe("Global level 3! (+1 perception, +1 charisma) — next at 240 XP");
  });

  it("formats class level up message correctly", () => {
    const raceDef = getRaceDef("human");
    const classDef = getClassDef("otherworlder");
    const msg = getClassLevelUpMessage(2, classDef, raceDef);
    // Otherworlder Lv. 2 growth cycle gains
    expect(msg).toContain("Otherworlder reached level 2!");
    expect(msg).toContain("— next at");
  });
});
