import type { LogEntry } from "../LogEntry";

type GameLogContext = {
  tick: number;
  worldTimeMinutes: number;
};

/**
 * Owns the persisted player-facing chronology for one playthrough.
 *
 * The engine supplies simulation time, while this class owns entry creation,
 * consecutive-message suppression, and detached projections for saves/UI.
 */
export class GameLog {
  private entries: LogEntry[] = [];

  constructor(private readonly getContext: () => GameLogContext) {}

  add(message: string): void {
    const context = this.getContext();
    this.entries.push({
      tick: context.tick,
      worldTimeMinutes: context.worldTimeMinutes,
      message,
    });
  }

  /** Avoids repeating the same immediate failure while input is held. */
  addUnlessRepeated(message: string): void {
    if (this.entries[this.entries.length - 1]?.message === message) return;
    this.add(message);
  }

  /** Replaces the history with detached entries restored from a save. */
  restore(entries: readonly LogEntry[]): void {
    this.entries = entries.map((entry) => ({ ...entry }));
  }

  /** Returns detached entries for UI snapshots and save serialization. */
  getEntries(): LogEntry[] {
    return this.entries.map((entry) => ({ ...entry }));
  }
}
