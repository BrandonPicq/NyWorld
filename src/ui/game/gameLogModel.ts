import { createWorldTimeSnapshot, type LogEntry } from "../../engine";

export const COMPACT_LOG_DURATION_MS = 3000;

/** Formats a persisted log entry consistently across the game log surfaces. */
export function formatGameLogEntry(entry: LogEntry): string {
  return `[${createWorldTimeSnapshot(entry.worldTimeMinutes).timeLabel}] ${entry.message}`;
}

/** Builds a stable identity even when two entries share the same engine tick. */
export function getGameLogEntryKey(entry: LogEntry, index: number): string {
  return `${entry.tick}:${index}:${entry.message}`;
}

/** Returns whether a snapshot contains a newly appended or replaced log tail. */
export function hasNewGameLogEntry(
  previous: readonly LogEntry[] | null,
  current: readonly LogEntry[],
): boolean {
  if (current.length === 0) return false;
  if (!previous || previous.length === 0) return true;
  const previousLast = previous[previous.length - 1];
  const currentLast = current[current.length - 1];
  return (
    current.length !== previous.length ||
    getGameLogEntryKey(previousLast, previous.length - 1) !==
      getGameLogEntryKey(currentLast, current.length - 1)
  );
}

/** Returns the newest entries for the compact overlay without mutating history. */
export function getCompactGameLogEntries(
  log: readonly LogEntry[],
  limit = 3,
): LogEntry[] {
  return log.slice(Math.max(0, log.length - limit));
}

export type OverlayRect = {
  left: number;
  top: number;
  width: number;
  height: number;
};

/** Returns whether two viewport rectangles overlap, including a safety margin. */
export function overlayRectsOverlap(
  first: OverlayRect,
  second: OverlayRect,
  margin = 0,
): boolean {
  return (
    first.left - margin < second.left + second.width &&
    first.left + first.width + margin > second.left &&
    first.top - margin < second.top + second.height &&
    first.top + first.height + margin > second.top
  );
}

/** Returns whether the compact surface should still be visible at a given time. */
export function isCompactGameLogVisible(
  lastShownAt: number | undefined,
  now: number,
): boolean {
  return lastShownAt !== undefined && now - lastShownAt < COMPACT_LOG_DURATION_MS;
}
