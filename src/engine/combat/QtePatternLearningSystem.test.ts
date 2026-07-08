import { describe, expect, it } from "vitest";
import type { Inventory } from "../components";
import { createInitialStats } from "../stats/characterStats";
import type { KnownPatternMap } from "./PatternDef";
import {
  QtePatternLearningSystem,
  type QtePatternLearningSystemContext,
} from "./QtePatternLearningSystem";

function createHarness(input: {
  itemId: string;
  quantity?: number;
  globalLevel?: number;
  intelligence?: number;
  knownPatterns?: KnownPatternMap;
}) {
  const inventory: Inventory = {
    type: "Inventory",
    items: [{ itemId: input.itemId, quantity: input.quantity ?? 1 }],
    equipped: {},
  };
  const stats = createInitialStats();
  stats.attributes.intelligence = input.intelligence ?? 10;
  const knownPatterns = input.knownPatterns ?? {};
  const log: string[] = [];
  const notices: Array<{ title: string; message: string }> = [];
  let tick = 0;
  let worldTime = 0;

  const context: QtePatternLearningSystemContext = {
    getPlayerInventory: () => inventory,
    getPlayerStats: () => stats,
    getGlobalLevel: () => input.globalLevel ?? 1,
    getKnownPatterns: () => knownPatterns,
    addLog: (message) => log.push(message),
    addNotice: (notice) => notices.push(notice),
    advanceTick: () => {
      tick += 1;
    },
    advanceWorldTime: (minutes) => {
      worldTime += minutes;
    },
  };

  return {
    inventory,
    knownPatterns,
    log,
    notices,
    get tick() {
      return tick;
    },
    get worldTime() {
      return worldTime;
    },
    system: new QtePatternLearningSystem(context),
  };
}

describe("QtePatternLearningSystem", () => {
  it("learns a pattern from a tome and consumes one item", () => {
    const harness = createHarness({
      itemId: "crosscut_tome",
      globalLevel: 2,
    });

    const result = harness.system.usePatternTome("crosscut_tome");

    expect(result).toEqual({
      success: true,
      effects: [
        {
          type: "PatternLearned",
          itemId: "crosscut_tome",
          patternId: "crosscut",
        },
      ],
    });
    expect(harness.knownPatterns.crosscut).toEqual({ timesUsed: 0 });
    expect(harness.inventory.items).toEqual([]);
    expect(harness.tick).toBe(1);
    expect(harness.worldTime).toBe(5);
    expect(harness.log).toContain("Learned Crosscut.");
    expect(harness.notices).toContainEqual({
      title: "Pattern Learned",
      message: "Learned Crosscut.",
    });
  });

  it("refuses a tome when requirements are not met without consuming it", () => {
    const harness = createHarness({ itemId: "fireball_tome" });

    const result = harness.system.usePatternTome("fireball_tome");

    expect(result).toEqual({
      success: false,
      effects: [
        {
          type: "ItemUseRejected",
          itemId: "fireball_tome",
          reason: "requirements_not_met",
          message: "Tome of Fireball requires level 2 and intelligence 12.",
        },
      ],
    });
    expect(harness.knownPatterns).toEqual({});
    expect(harness.inventory.items).toEqual([
      { itemId: "fireball_tome", quantity: 1 },
    ]);
    expect(harness.tick).toBe(0);
  });

  it("refuses an already-known pattern without consuming the tome", () => {
    const harness = createHarness({
      itemId: "crosscut_tome",
      globalLevel: 2,
      knownPatterns: { crosscut: { timesUsed: 0 } },
    });

    const result = harness.system.usePatternTome("crosscut_tome");

    expect(result).toEqual({
      success: false,
      effects: [
        {
          type: "ItemUseRejected",
          itemId: "crosscut_tome",
          reason: "already_known",
          message: "You already know Crosscut.",
        },
      ],
    });
    expect(harness.inventory.items).toEqual([
      { itemId: "crosscut_tome", quantity: 1 },
    ]);
  });
});
