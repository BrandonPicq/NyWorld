import { describe, expect, it } from "vitest";
import {
  START_WORLD_TIME_MINUTES,
  WORLD_CALENDAR,
  createWorldTimeSnapshot,
  encodeWorldDateTime,
  formatWorldDateTime,
} from "./WorldCalendar";

describe("WorldCalendar", () => {
  it("encodes the configured start date in year 425", () => {
    expect(createWorldTimeSnapshot(START_WORLD_TIME_MINUTES)).toMatchObject({
      year: 425,
      month: 1,
      monthName: "Aubeclat",
      day: 1,
      hour: 8,
      minute: 0,
      dateLabel: "1 Aubeclat 425",
      timeLabel: "08:00",
    });
  });

  it("rolls over months and years after 30-day months", () => {
    const lastMomentOfYear = encodeWorldDateTime({
      year: 425,
      month: WORLD_CALENDAR.monthsPerYear,
      day: WORLD_CALENDAR.daysPerMonth,
      hour: 23,
      minute: 59,
    });

    expect(formatWorldDateTime(lastMomentOfYear + 1)).toBe(
      "1 Aubeclat 426, 00:00",
    );
  });
});
