import { describe, expect, it } from "vitest";

import {
  getAllRaceIds,
  getRaceDef,
  hasRaceDef,
  validateRaceDef,
} from "./raceRegistry";

describe("raceRegistry", () => {
  it("loads the shipped race multipliers", () => {
    expect(getAllRaceIds()).toEqual(["dwarf", "elf", "human", "orc"]);
    expect(hasRaceDef("elf")).toBe(true);
    expect(getRaceDef("orc").growthMultipliers.strength).toBe(1.2);
  });

  it("returns detached race definitions", () => {
    const first = getRaceDef("elf");
    first.growthMultipliers.agility = 99;

    expect(getRaceDef("elf").growthMultipliers.agility).toBe(1.15);
  });

  it("reports invalid race multiplier attributes", () => {
    const diagnostics = validateRaceDef({
      raceId: "bad_race",
      name: "Bad Race",
      description: "Invalid.",
      growthMultipliers: { luck: 1 },
    });

    expect(diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          severity: "error",
          contentType: "race",
          path: "growthMultipliers.luck",
        }),
      ]),
    );
  });
});
