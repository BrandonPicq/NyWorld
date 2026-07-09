import { describe, expect, it } from "vitest";
import { defaultContentBundle } from "../content/contentBundle";
import { createRuntimeContentValidationContext } from "../content/runtimeValidationContext";
import { getAllEventDefs, validateEventDef, validateEventRegistry } from "./eventRegistry";

const validEvent = {
  eventId: "meet-scholar",
  trigger: { type: "step_on_area", zoneId: "test_zone", area: { x: 1, y: 1, width: 1, height: 1 } },
  conditions: [
    { type: "has_item", itemId: "travel_ration", quantity: 1 },
    { type: "world_flag", flag: "chapter.intro_done", value: false },
  ],
  actions: [
    { type: "dialogue", dialogueId: "old_scholar.default" },
    { type: "give_item", itemId: "travel_ration", quantity: 1 },
    { type: "set_flag", flag: "chapter.intro_done" },
  ],
  repeatPolicy: "once_per_playthrough",
  priority: 10,
};

describe("Event content validation", () => {
  it("accepts a valid area event and resolves the shipped registry", () => {
    const context = createRuntimeContentValidationContext(defaultContentBundle);
    expect(validateEventDef(validEvent, context)).toEqual([]);
    expect(getAllEventDefs()).toEqual([]);
  });

  it("accumulates reference, area, and flag diagnostics", () => {
    const context = createRuntimeContentValidationContext(defaultContentBundle);
    const diagnostics = validateEventDef(
      {
        ...validEvent,
        eventId: "Bad Event",
        trigger: { type: "step_on_area", zoneId: "missing_zone", area: { x: 0, y: 0, width: 0, height: 1 } },
        conditions: [
          { type: "world_flag", flag: "Bad Flag", value: "yes" },
          { type: "has_item", itemId: "missing_item", quantity: 0 },
        ],
        actions: [{ type: "dialogue", dialogueId: "missing_dialogue" }],
      },
      context,
    );

    expect(diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: "eventId" }),
        expect.objectContaining({ path: "trigger.zoneId" }),
        expect.objectContaining({ path: "trigger.area.width" }),
        expect.objectContaining({ path: "conditions[0].flag" }),
        expect.objectContaining({ path: "conditions[0].value" }),
        expect.objectContaining({ path: "conditions[1].itemId" }),
        expect.objectContaining({ path: "conditions[1].quantity" }),
        expect.objectContaining({ path: "actions[0].dialogueId" }),
      ]),
    );
  });

  it("reports duplicate ids through registry-level diagnostics", () => {
    const context = createRuntimeContentValidationContext(defaultContentBundle);
    const diagnostics = validateEventRegistry([validEvent, validEvent], context);
    expect(diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: "eventId", message: 'Duplicate event definition "meet-scholar".' }),
      ]),
    );
  });
});
