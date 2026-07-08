import type { Inventory, Stats } from "../components";
import { WORLD_TIME_ACTION_COST } from "../time/WorldCalendar";
import { getItemDef } from "../items/itemRegistry";
import type { KnownPatternMap, KnownPatternState } from "./PatternDef";
import { getQtePatternDef } from "./qtePatternRegistry";

export type PatternLearningRejectReason =
  | "already_known"
  | "missing_pattern"
  | "requirements_not_met";

export type PatternLearningEffect =
  | {
      type: "PatternLearned";
      itemId: string;
      patternId: string;
    }
  | {
      type: "ItemUseRejected";
      itemId: string;
      reason: PatternLearningRejectReason;
      message: string;
    };

export interface PatternLearningResult {
  success: boolean;
  effects?: PatternLearningEffect[];
}

export interface PatternLearningNotice {
  title: string;
  message: string;
}

export interface QtePatternLearningSystemContext {
  getPlayerInventory: () => Inventory;
  getPlayerStats: () => Stats;
  getGlobalLevel: () => number;
  getKnownPatterns: () => KnownPatternMap;
  addLog: (message: string) => void;
  addNotice: (notice: PatternLearningNotice) => void;
  advanceTick: () => void;
  advanceWorldTime: (minutes: number) => void;
}

export class QtePatternLearningSystem {
  constructor(private readonly context: QtePatternLearningSystemContext) {}

  canHandleItem(itemId: string): boolean {
    return getItemDef(itemId).effects?.teachesPatternId !== undefined;
  }

  usePatternTome(itemId: string): PatternLearningResult {
    const inventory = this.context.getPlayerInventory();
    const stackIndex = inventory.items.findIndex(
      (stack) => stack.itemId === itemId,
    );

    if (stackIndex === -1) {
      this.context.addLog("You don't have that item.");
      return { success: false };
    }

    const itemDef = getItemDef(itemId);
    if (itemDef.category !== "consumable") {
      this.context.addLog(`${itemDef.name} cannot be used.`);
      return { success: false };
    }

    const patternId = itemDef.effects?.teachesPatternId;
    if (!patternId) {
      const message = `${itemDef.name} has no pattern to teach.`;
      this.context.addLog(message);
      return {
        success: false,
        effects: [
          { type: "ItemUseRejected", itemId, reason: "missing_pattern", message },
        ],
      };
    }

    const pattern = getQtePatternDef(patternId);
    if (!pattern) {
      const message = `${itemDef.name} refers to an unknown pattern.`;
      this.context.addLog(message);
      return {
        success: false,
        effects: [
          { type: "ItemUseRejected", itemId, reason: "missing_pattern", message },
        ],
      };
    }

    const knownPatterns = this.context.getKnownPatterns();
    if (knownPatterns[patternId]) {
      const message = `You already know ${pattern.name}.`;
      this.context.addLog(message);
      return {
        success: false,
        effects: [
          { type: "ItemUseRejected", itemId, reason: "already_known", message },
        ],
      };
    }

    const stats = this.context.getPlayerStats();
    const missingRequirements = [];
    if (this.context.getGlobalLevel() < pattern.requiredPlayerLevel) {
      missingRequirements.push(`level ${pattern.requiredPlayerLevel}`);
    }
    if (stats.attributes.intelligence < pattern.requiredIntelligence) {
      missingRequirements.push(`intelligence ${pattern.requiredIntelligence}`);
    }

    if (missingRequirements.length > 0) {
      const message = `${itemDef.name} requires ${missingRequirements.join(" and ")}.`;
      this.context.addLog(message);
      return {
        success: false,
        effects: [
          {
            type: "ItemUseRejected",
            itemId,
            reason: "requirements_not_met",
            message,
          },
        ],
      };
    }

    knownPatterns[patternId] = createKnownPatternState();
    const stack = inventory.items[stackIndex];
    stack.quantity -= 1;
    if (stack.quantity <= 0) {
      inventory.items.splice(stackIndex, 1);
    }

    this.context.advanceTick();
    this.context.advanceWorldTime(WORLD_TIME_ACTION_COST.useItem);
    const message = `Learned ${pattern.name}.`;
    this.context.addLog(message);
    this.context.addNotice({ title: "Pattern Learned", message });

    return {
      success: true,
      effects: [{ type: "PatternLearned", itemId, patternId }],
    };
  }
}

export function createKnownPatternState(): KnownPatternState {
  return { timesUsed: 0 };
}

export function cloneKnownPatterns(
  knownPatterns: KnownPatternMap,
): KnownPatternMap {
  return Object.fromEntries(
    Object.entries(knownPatterns).map(([patternId, state]) => [
      patternId,
      { timesUsed: Math.max(0, Math.floor(state.timesUsed ?? 0)) },
    ]),
  );
}
