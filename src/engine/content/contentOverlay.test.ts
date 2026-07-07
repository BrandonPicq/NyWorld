import { afterEach, describe, expect, it } from "vitest";

import { getClassDef } from "../classes/classRegistry";
import { getRaceDef } from "../races/raceRegistry";
import { clearContentOverlay, installContentOverlay } from "./contentOverlay";
import { createRuntimeContentCatalogSnapshot } from "./runtimeContentCatalog";
import { createRuntimeContentValidationContext } from "./runtimeValidationContext";

describe("content overlay", () => {
  afterEach(() => {
    clearContentOverlay();
  });

  it("overlays class and race content for editor playtests", () => {
    const snapshot = createRuntimeContentCatalogSnapshot();
    snapshot.classes = [
      {
        classId: "draft_class",
        name: "Draft Class",
        description: "A draft-only class.",
        equipmentPermissions: {
          allowedWeaponTypes: ["staff"],
          allowedArmorSlots: ["accessory"],
        },
        growthCycle: [{ level: 2, attributes: { intelligence: 1 } }],
      },
    ];
    snapshot.races = [
      {
        raceId: "draft_race",
        name: "Draft Race",
        description: "A draft-only race.",
        growthMultipliers: { intelligence: 1.2 },
      },
    ];

    installContentOverlay(snapshot, createRuntimeContentValidationContext());

    expect(getClassDef("draft_class").name).toBe("Draft Class");
    expect(getRaceDef("draft_race").growthMultipliers.intelligence).toBe(1.2);
    expect(getClassDef("missing_class").growthCycle).toEqual([]);

    clearContentOverlay();

    expect(getClassDef("draft_class").name).toBe("Unknown Class");
    expect(getRaceDef("draft_race").name).toBe("Unknown Race");
  });
});
