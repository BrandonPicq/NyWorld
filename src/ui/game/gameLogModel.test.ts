import { describe, expect, it } from "vitest";
import type { LogEntry } from "../../engine";
import {
  COMPACT_LOG_DURATION_MS,
  formatGameLogEntry,
  getCompactGameLogEntries,
  hasNewGameLogEntry,
  isCompactGameLogVisible,
  overlayRectsOverlap,
} from "./gameLogModel";

function log(message: string, tick: number): LogEntry {
  return { message, tick, worldTimeMinutes: 125 };
}

describe("gameLogModel", () => {
  it("formats entries with the narrative clock", () => {
    expect(formatGameLogEntry(log("Found an old note.", 1))).toBe(
      "[02:05] Found an old note.",
    );
  });

  it("detects appended entries including repeated messages", () => {
    const first = [log("Found an old note.", 1)];
    expect(hasNewGameLogEntry(null, first)).toBe(true);
    expect(hasNewGameLogEntry(first, first)).toBe(false);
    expect(hasNewGameLogEntry(first, [...first, log("Found an old note.", 2)])).toBe(true);
  });

  it("keeps only the newest three entries for the compact overlay", () => {
    const entries = [1, 2, 3, 4].map((tick) => log(String(tick), tick));
    expect(getCompactGameLogEntries(entries).map((entry) => entry.message)).toEqual([
      "2",
      "3",
      "4",
    ]);
  });

  it("expires the compact surface after three seconds", () => {
    expect(isCompactGameLogVisible(1_000, 1_000 + COMPACT_LOG_DURATION_MS - 1)).toBe(true);
    expect(isCompactGameLogVisible(1_000, 1_000 + COMPACT_LOG_DURATION_MS)).toBe(false);
    expect(isCompactGameLogVisible(undefined, 1_000)).toBe(false);
  });

  it("detects when the player enters the overlay safety margin", () => {
    const logRect = { left: 380, top: 270, width: 480, height: 72 };
    expect(overlayRectsOverlap({ left: 360, top: 340, width: 32, height: 32 }, logRect, 16)).toBe(true);
    expect(overlayRectsOverlap({ left: 120, top: 340, width: 32, height: 32 }, logRect, 16)).toBe(false);
  });
});
