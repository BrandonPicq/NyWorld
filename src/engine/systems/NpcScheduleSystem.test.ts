import { describe, expect, it } from "vitest";
import { encodeWorldDateTime } from "../time/WorldCalendar";
import { NpcScheduleSystem, parseScheduleTime } from "./NpcScheduleSystem";

const schedule = [
  { time: "08:00", x: 2, y: 1 },
  { time: "18:00", x: 1, y: 2 },
];

describe("NpcScheduleSystem", () => {
  it("parses valid schedule times", () => {
    expect(parseScheduleTime("00:00")).toBe(0);
    expect(parseScheduleTime("18:30")).toBe(1110);
    expect(parseScheduleTime("23:59")).toBe(1439);
  });

  it("rejects invalid schedule times", () => {
    expect(parseScheduleTime("8:00")).toBeUndefined();
    expect(parseScheduleTime("24:00")).toBeUndefined();
    expect(parseScheduleTime("18:60")).toBeUndefined();
  });

  it("returns no scheduled position before the first reached entry", () => {
    const time = encodeWorldDateTime({
      year: 425,
      month: 1,
      day: 1,
      hour: 7,
      minute: 50,
    });

    expect(NpcScheduleSystem.getActivePosition(schedule, time)).toBeUndefined();
  });

  it("returns the latest reached schedule position for the current day", () => {
    const morning = encodeWorldDateTime({
      year: 425,
      month: 1,
      day: 1,
      hour: 9,
      minute: 0,
    });
    const evening = encodeWorldDateTime({
      year: 425,
      month: 1,
      day: 1,
      hour: 18,
      minute: 0,
    });

    expect(NpcScheduleSystem.getActivePosition(schedule, morning)).toEqual({
      x: 2,
      y: 1,
    });
    expect(NpcScheduleSystem.getActivePosition(schedule, evening)).toEqual({
      x: 1,
      y: 2,
    });
  });

  it("returns dialogueId if defined in schedule", () => {
    const scheduleWithDialogue = [
      { time: "08:00", x: 2, y: 1, dialogueId: "young_page.default" },
      { time: "18:00", x: 1, y: 2, dialogueId: "young_page.evening" },
    ];
    const morning = encodeWorldDateTime({
      year: 425,
      month: 1,
      day: 1,
      hour: 9,
      minute: 0,
    });
    const evening = encodeWorldDateTime({
      year: 425,
      month: 1,
      day: 1,
      hour: 18,
      minute: 0,
    });

    expect(
      NpcScheduleSystem.getActivePosition(scheduleWithDialogue, morning),
    ).toEqual({
      x: 2,
      y: 1,
      dialogueId: "young_page.default",
    });
    expect(
      NpcScheduleSystem.getActivePosition(scheduleWithDialogue, evening),
    ).toEqual({
      x: 1,
      y: 2,
      dialogueId: "young_page.evening",
    });
  });
});
