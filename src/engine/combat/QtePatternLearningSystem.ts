import type { Inventory, Stats } from "../components";
import { WORLD_TIME_ACTION_COST } from "../time/WorldCalendar";
import { getItemDef } from "../items/itemRegistry";
import type {
  KnownPatternMap,
  KnownPatternState,
  PatternDef,
} from "./PatternDef";
import { getAllQtePatternDefs, getQtePatternDef } from "./qtePatternRegistry";

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

export interface LearnPatternResult {
  success: boolean;
  patternId?: string;
  reason?: PatternLearningRejectReason;
  message?: string;
}

type LearnPatternSource =
  | {
      type: "tome";
      requirementSubject: string;
    }
  | {
      type: "evolution";
      fromPatternId: string;
    };

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

    const learnResult = this.learnPattern(patternId, {
      type: "tome",
      requirementSubject: itemDef.name,
    });
    if (!learnResult.success) {
      const message =
        learnResult.message ?? `${itemDef.name} cannot teach that pattern.`;
      const reason = learnResult.reason ?? "missing_pattern";
      return {
        success: false,
        effects: [
          {
            type: "ItemUseRejected",
            itemId,
            reason,
            message,
          },
        ],
      };
    }

    const stack = inventory.items[stackIndex];
    stack.quantity -= 1;
    if (stack.quantity <= 0) {
      inventory.items.splice(stackIndex, 1);
    }
    this.context.advanceTick();
    this.context.advanceWorldTime(WORLD_TIME_ACTION_COST.useItem);

    return {
      success: true,
      effects: [{ type: "PatternLearned", itemId, patternId }],
    };
  }

  learnPattern(patternId: string, source: LearnPatternSource): LearnPatternResult {
    const pattern = getQtePatternDef(patternId);
    if (!pattern) {
      const message =
        source.type === "tome"
          ? `${source.requirementSubject} refers to an unknown pattern.`
          : `Unknown pattern "${patternId}" could not be learned.`;
      this.context.addLog(message);
      return { success: false, reason: "missing_pattern", message };
    }

    const knownPatterns = this.context.getKnownPatterns();
    if (knownPatterns[patternId]) {
      const message = `You already know ${pattern.name}.`;
      this.context.addLog(message);
      return { success: false, reason: "already_known", message };
    }

    const missingRequirements = getMissingLearnRequirements(
      pattern,
      this.context.getGlobalLevel(),
      source.type === "tome"
        ? this.context.getPlayerStats().attributes.intelligence
        : undefined,
    );
    if (missingRequirements.length > 0) {
      const subject =
        source.type === "tome" ? source.requirementSubject : pattern.name;
      const message = `${subject} requires ${missingRequirements.join(" and ")}.`;
      this.context.addLog(message);
      return { success: false, reason: "requirements_not_met", message };
    }

    knownPatterns[patternId] = createKnownPatternState();
    const message =
      source.type === "evolution"
        ? getEvolutionLearnedMessage(pattern, source.fromPatternId)
        : `Learned ${pattern.name}.`;
    this.context.addLog(message);
    this.context.addNotice({
      title:
        source.type === "evolution" ? "Technique Evolved" : "Pattern Learned",
      message,
    });

    return { success: true, patternId, message };
  }

  learnEligibleEvolutions(sourcePatternId: string): string[] {
    const sourceState = this.context.getKnownPatterns()[sourcePatternId];
    if (!sourceState) {
      return [];
    }

    const learnedPatternIds: string[] = [];
    const knownPatterns = this.context.getKnownPatterns();
    for (const pattern of getAllQtePatternDefs()) {
      if (pattern.evolvesFrom?.patternId !== sourcePatternId) {
        continue;
      }
      if (knownPatterns[pattern.patternId]) {
        continue;
      }
      if (sourceState.timesUsed < pattern.evolvesFrom.usageRequired) {
        continue;
      }
      if (this.context.getGlobalLevel() < pattern.requiredPlayerLevel) {
        continue;
      }

      const result = this.learnPattern(pattern.patternId, {
        type: "evolution",
        fromPatternId: sourcePatternId,
      });
      if (result.success && result.patternId) {
        learnedPatternIds.push(result.patternId);
      }
    }

    return learnedPatternIds;
  }
}

function getMissingLearnRequirements(
  pattern: PatternDef,
  globalLevel: number,
  intelligence: number | undefined,
): string[] {
  const missingRequirements = [];
  if (globalLevel < pattern.requiredPlayerLevel) {
    missingRequirements.push(`level ${pattern.requiredPlayerLevel}`);
  }
  if (
    intelligence !== undefined &&
    intelligence < pattern.requiredIntelligence
  ) {
    missingRequirements.push(`intelligence ${pattern.requiredIntelligence}`);
  }
  return missingRequirements;
}

function getEvolutionLearnedMessage(
  pattern: PatternDef,
  sourcePatternId: string,
): string {
  const sourcePattern = getQtePatternDef(sourcePatternId);
  const sourceName = sourcePattern?.name ?? sourcePatternId;
  return `Your ${sourceName} technique evolved into ${pattern.name}.`;
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
