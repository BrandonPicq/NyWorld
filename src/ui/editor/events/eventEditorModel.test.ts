import { describe, expect, it } from "vitest";
import type { EventDef } from "../../../engine";
import {
  addEventAction,
  addEventCondition,
  createEventDef,
  removeEventAction,
  removeEventCondition,
  validateNewEventId,
} from "./eventEditorModel";

const event: EventDef = createEventDef("intro_event", "test_zone");

describe("event editor model", () => {
  it("creates and validates stable event ids", () => {
    expect(event.actions).toHaveLength(1);
    expect(validateNewEventId("", [event])).toHaveLength(1);
    expect(validateNewEventId("intro_event", [event])).toContain('Event "intro_event" already exists.');
    expect(validateNewEventId("new_event", [event])).toEqual([]);
  });

  it("edits ordered condition and action lists without mutating the draft", () => {
    const withCondition = addEventCondition(event, "world_flag");
    const withAction = addEventAction(withCondition, "give_item");
    expect(event.conditions).toEqual([]);
    expect(event.actions).toHaveLength(1);
    expect(withAction.conditions).toHaveLength(1);
    expect(withAction.actions).toHaveLength(2);
    expect(removeEventAction(withAction, 0).actions).toHaveLength(1);
    expect(removeEventCondition(withAction, 0).conditions).toEqual([]);
  });
});
