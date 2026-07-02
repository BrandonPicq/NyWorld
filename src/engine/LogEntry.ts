/**
 * One player-facing action log line.
 *
 * Both technical tick and world time are retained so debug tools and narrative
 * UI can choose the most useful timestamp.
 */
export interface LogEntry {
  tick: number;
  worldTimeMinutes: number;
  message: string;
}
