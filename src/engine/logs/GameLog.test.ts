import { describe, expect, it } from "vitest";
import { GameLog } from "./GameLog";

describe("GameLog", () => {
  it("stamps entries with the current simulation context", () => {
    const context = { tick: 4, worldTimeMinutes: 125 };
    const log = new GameLog(() => context);

    log.add("Found an old note.");
    context.tick = 5;
    context.worldTimeMinutes = 135;
    log.add("Entered the archive.");

    expect(log.getEntries()).toEqual([
      { tick: 4, worldTimeMinutes: 125, message: "Found an old note." },
      { tick: 5, worldTimeMinutes: 135, message: "Entered the archive." },
    ]);
  });

  it("collapses only consecutive duplicate messages", () => {
    const log = new GameLog(() => ({ tick: 1, worldTimeMinutes: 120 }));

    log.addUnlessRepeated("The way is blocked.");
    log.addUnlessRepeated("The way is blocked.");
    log.add("You pause to listen.");
    log.addUnlessRepeated("The way is blocked.");

    expect(log.getEntries().map((entry) => entry.message)).toEqual([
      "The way is blocked.",
      "You pause to listen.",
      "The way is blocked.",
    ]);
  });

  it("restores and exposes detached save data", () => {
    const log = new GameLog(() => ({ tick: 0, worldTimeMinutes: 0 }));
    const restored = [{ tick: 7, worldTimeMinutes: 200, message: "Saved memory." }];

    log.restore(restored);
    restored[0].message = "Mutated outside the log.";
    const snapshot = log.getEntries();
    snapshot[0].message = "Mutated snapshot.";

    expect(log.getEntries()).toEqual([
      { tick: 7, worldTimeMinutes: 200, message: "Saved memory." },
    ]);
  });
});
