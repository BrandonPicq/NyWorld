import { describe, expect, it } from "vitest";

import { createRuntimeContentValidationContext } from "./runtimeValidationContext";

describe("createRuntimeContentValidationContext", () => {
  it("collects every shipped content id family", () => {
    const context = createRuntimeContentValidationContext();

    expect(context.itemIds.has("travel_ration")).toBe(true);
    expect(context.npcIds.has("old_wizard")).toBe(true);
    expect(context.dialogueIds.size).toBeGreaterThan(0);
    expect(context.enemyIds.has("slime")).toBe(true);
    expect(context.questIds.has("slay_the_slime")).toBe(true);
    expect(context.combatActionIds.has("strike")).toBe(true);
    expect(context.tileDefs.get(0)?.walkable).toBe(true);
    expect(context.zones.has("test_zone")).toBe(true);
    expect(context.zones.has("test_zone_2")).toBe(true);
  });

  it("resolves zones into walkability-aware maps", () => {
    const context = createRuntimeContentValidationContext();
    const zone = context.zones.get("test_zone");

    expect(zone).toBeDefined();
    expect(typeof zone!.isWalkable).toBe("function");
  });
});
