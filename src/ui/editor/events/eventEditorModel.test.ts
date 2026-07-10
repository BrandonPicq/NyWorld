import { describe, expect, it } from "vitest";
import type { EventDef } from "../../../engine";
import {
  addEventAction,
  addEventCondition,
  createEventDef,
  groupEventEntries,
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

  it("groups events by trigger type and zone with global fallback", () => {
    const entries = [
      createEventDef("global_event", "unused"),
      {
        ...createEventDef("zone_entry_b", "zone_b"),
        eventId: "zone_entry_b",
      },
      {
        ...createEventDef("zone_entry_a", "zone_a"),
        eventId: "zone_entry_a",
      },
    ];
    entries[0] = {
      ...entries[0],
      trigger: { type: "calendar_time", minutes: 480 },
    };

    expect(groupEventEntries(entries, "type").map((group) => group.label)).toEqual([
      "calendar_time",
      "enter_zone",
    ]);
    expect(groupEventEntries(entries, "zone").map((group) => group.label)).toEqual([
      "Global",
      "zone_a",
      "zone_b",
    ]);
  });
});
