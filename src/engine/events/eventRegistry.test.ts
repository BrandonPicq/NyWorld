import { describe, expect, it } from "vitest";
import { defaultContentBundle } from "../content/contentBundle";
import { createRuntimeContentValidationContext } from "../content/runtimeValidationContext";
import { GameplayEngine } from "../GameplayEngine";
import { loadZone } from "../zoneLoader";
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
    // Content authors add events over time; assert the shipped baseline is
    // present instead of pinning the full list.
    expect(getAllEventDefs().map((event) => event.eventId)).toEqual(
      expect.arrayContaining([
        "test_fields_welcome",
        "test_zone_2_entry",
        "test_zone_entry",
      ]),
    );
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

  it("runs the authored area event through the gameplay command path", () => {
    const map = loadZone({
      version: "0.1",
      zoneId: "test_zone",
      name: "Event Test Zone",
      width: 7,
      height: 6,
      playerStart: { x: 5, y: 4 },
      tiles: [
        [1, 1, 1, 1, 1, 1, 1],
        [1, 0, 0, 0, 0, 0, 1],
        [1, 0, 0, 0, 0, 0, 1],
        [1, 0, 0, 0, 0, 0, 1],
        [1, 0, 0, 0, 0, 0, 1],
        [1, 1, 1, 1, 1, 1, 1],
      ],
    });
    const engine = new GameplayEngine(map, {
      events: getAllEventDefs().filter((event) => event.eventId === "test_fields_welcome"),
    });
    const result = engine.execute({ type: "Interact" });

    // The fired event makes the interaction a success even with no NPC nearby.
    expect(result.success).toBe(true);
    expect(engine.getSnapshot().worldFlags).toEqual(["test.fields_welcome"]);
    expect(engine.consumeNotices()).toEqual([
      {
        title: "World Event",
        message: "The test fields remember your arrival.",
      },
    ]);
  });

  it("pauses an action queue on dialogue and resumes after completion", () => {
    const map = loadZone({
      version: "0.1",
      zoneId: "test_zone",
      name: "Event Dialogue Zone",
      width: 7,
      height: 6,
      playerStart: { x: 5, y: 4 },
      tiles: [
        [1, 1, 1, 1, 1, 1, 1],
        [1, 0, 0, 0, 0, 0, 1],
        [1, 0, 0, 0, 0, 0, 1],
        [1, 0, 0, 0, 0, 0, 1],
        [1, 0, 0, 0, 0, 0, 1],
        [1, 1, 1, 1, 1, 1, 1],
      ],
    });
    const engine = new GameplayEngine(map, {
      events: [
        {
          eventId: "dialogue_then_notice",
          trigger: { type: "interact_on_area", zoneId: "test_zone", area: { x: 5, y: 4, width: 1, height: 1 } },
          conditions: [],
          actions: [
            { type: "dialogue", dialogueId: "old_scholar.default" },
            { type: "notice", message: "The queue resumed." },
          ],
          repeatPolicy: "once_per_playthrough",
          priority: 1,
        },
      ],
    });

    const opened = engine.execute({ type: "Interact" });
    expect(opened.dialogueId).toBe("old_scholar.default");
    expect(engine.consumeNotices()).toEqual([]);

    engine.execute({ type: "CompleteDialogue" });
    expect(engine.consumeNotices()).toEqual([
      { title: "World Event", message: "The queue resumed." },
    ]);
  });
});
