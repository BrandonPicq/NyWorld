import type { Inventory, Position, Quests, Stats } from "../components";
import { getItemDef } from "../items/itemRegistry";
import { getStatValue } from "../stats/characterStats";
import {
  getQuestDef,
  hasQuestDef,
} from "./questRegistry";

export type QuestProgressionEffect =
  | {
      type: "ItemCollected";
      itemId: string;
      quantity: number;
      source: "reward";
    }
  | {
      type: "ItemLost";
      itemId: string;
      quantity: number;
      source: "quest_turn_in";
    };

export interface QuestProgressionNotice {
  title: string;
  message: string;
}

export interface QuestProgressionSystemContext {
  getPlayerInventory: () => Inventory;
  getPlayerQuests: () => Quests;
  getPlayerStats: () => Stats;
  getPlayerPosition: () => Position;
  getZoneId: () => string;
  addLog: (message: string) => void;
  addNotice: (notice: QuestProgressionNotice) => void;
  awardXp: (amount: number, source: string) => void;
}

/**
 * Owns quest lifecycle and objective progression while GameplayEngine keeps
 * world movement, dialogue resolution, saves, and combat orchestration.
 */
export class QuestProgressionSystem {
  constructor(private readonly context: QuestProgressionSystemContext) {}

  isQuestReadyToComplete(questId: string): boolean {
    const questDef = getQuestDef(questId);
    if (!questDef) return false;

    const inventory = this.context.getPlayerInventory();
    const quests = this.context.getPlayerQuests();
    const stats = this.context.getPlayerStats();
    const position = this.context.getPlayerPosition();
    const zoneId = this.context.getZoneId();

    for (const obj of questDef.objectives) {
      if (obj.type === "fetch_item") {
        const currentQty = inventory.items
          .filter((item) => item.itemId === obj.itemId)
          .reduce((sum, item) => sum + item.quantity, 0);
        if (currentQty < obj.quantity) {
          return false;
        }
      } else if (obj.type === "visit_coordinate") {
        const visited =
          hasCompletedQuestObjective(quests, questId, obj.id) ||
          (obj.zoneId === zoneId && obj.x === position.x && obj.y === position.y);
        if (!visited) {
          return false;
        }
      } else if (obj.type === "stat_threshold") {
        const currentVal = getStatValue(stats, obj.statName) ?? 0;
        if (currentVal < obj.threshold) {
          return false;
        }
      } else if (obj.type === "defeat_npc") {
        if (!hasCompletedQuestObjective(quests, questId, obj.id)) {
          return false;
        }
      }
    }

    return true;
  }

  startQuest(questId: string): void {
    const quests = this.context.getPlayerQuests();
    if (quests.active.includes(questId) || quests.completed.includes(questId)) {
      return;
    }
    quests.active.push(questId);
    const questDef = getQuestDef(questId)!;
    this.context.addLog(`Started Quest: ${questDef.name}`);
    this.checkCoordinateObjectives();
  }

  completeQuest(questId: string): QuestProgressionEffect[] {
    const quests = this.context.getPlayerQuests();
    if (!quests.active.includes(questId)) {
      return [];
    }
    if (!this.isQuestReadyToComplete(questId)) {
      return [];
    }

    const questDef = getQuestDef(questId)!;
    const effects: QuestProgressionEffect[] = [];

    // 1. Consume items
    const inventory = this.context.getPlayerInventory();
    const consumedItems = new Map<string, number>();
    for (const obj of questDef.objectives) {
      if (obj.type === "fetch_item") {
        let remaining = obj.quantity;
        for (let i = inventory.items.length - 1; i >= 0 && remaining > 0; i--) {
          const stack = inventory.items[i];
          if (stack.itemId === obj.itemId) {
            const consumed = Math.min(stack.quantity, remaining);
            stack.quantity -= consumed;
            remaining -= consumed;
            consumedItems.set(
              obj.itemId,
              (consumedItems.get(obj.itemId) ?? 0) + consumed,
            );
          }
        }
        inventory.items = inventory.items.filter((stack) => stack.quantity > 0);
      }
    }

    for (const [itemId, quantity] of consumedItems) {
      effects.push({
        type: "ItemLost",
        itemId,
        quantity,
        source: "quest_turn_in",
      });
    }

    const completedObjectiveKeys = new Set(
      questDef.objectives.map((obj) => getQuestObjectiveKey(questId, obj.id)),
    );
    quests.completedObjectives = quests.completedObjectives.filter(
      (objectiveKey) => !completedObjectiveKeys.has(objectiveKey),
    );

    // 2. Award rewards
    const stats = this.context.getPlayerStats();
    const rewardLogParts: string[] = [];
    if (questDef.rewards.currency) {
      stats.currency += questDef.rewards.currency;
      rewardLogParts.push(formatCurrencyReward(questDef.rewards.currency));
    }
    if (questDef.rewards.xp) {
      this.context.awardXp(questDef.rewards.xp, `completing ${questDef.name}`);
      rewardLogParts.push(`${questDef.rewards.xp} XP`);
    }
    if (questDef.rewards.items) {
      for (const rewardItem of questDef.rewards.items) {
        const existing = inventory.items.find(
          (item) => item.itemId === rewardItem.itemId,
        );
        if (existing) {
          existing.quantity += rewardItem.quantity;
        } else {
          inventory.items.push({
            itemId: rewardItem.itemId,
            quantity: rewardItem.quantity,
          });
        }

        const itemDef = getItemDef(rewardItem.itemId);
        rewardLogParts.push(
          `${itemDef.name}${rewardItem.quantity > 1 ? ` x${rewardItem.quantity}` : ""}`,
        );
        effects.push({
          type: "ItemCollected",
          itemId: rewardItem.itemId,
          quantity: rewardItem.quantity,
          source: "reward",
        });
      }
    }

    // 3. Mark completed
    quests.active = quests.active.filter((id) => id !== questId);
    quests.completed.push(questId);

    this.context.addLog(`Completed Quest: ${questDef.name}`);
    if (rewardLogParts.length > 0) {
      this.context.addLog(`Quest Rewards: ${rewardLogParts.join(", ")}.`);
    }

    return effects;
  }

  restoreQuestIds(
    activeQuestIds: string[],
    completedQuestIds: string[],
  ): { active: string[]; completed: string[] } {
    const unknownQuestIds = new Set<string>();
    const active = filterKnownQuestIds(activeQuestIds, unknownQuestIds);
    const completed = filterKnownQuestIds(completedQuestIds, unknownQuestIds);

    if (unknownQuestIds.size > 0) {
      const questList = Array.from(unknownQuestIds)
        .sort()
        .map((questId) => questId || "(empty quest id)")
        .join(", ");
      const message =
        `The saved quest data referenced unavailable quest ids and they were cancelled: ${questList}.`;
      this.context.addNotice({
        title: "Quest Cancelled",
        message,
      });
      this.context.addLog(message);
    }

    return { active, completed };
  }

  checkCoordinateObjectives(): void {
    const quests = this.context.getPlayerQuests();
    const position = this.context.getPlayerPosition();
    const zoneId = this.context.getZoneId();

    for (const questId of quests.active) {
      const questDef = getQuestDef(questId);
      if (!questDef) continue;

      for (const obj of questDef.objectives) {
        if (obj.type === "visit_coordinate") {
          if (
            obj.zoneId === zoneId &&
            obj.x === position.x &&
            obj.y === position.y
          ) {
            const objectiveKey = getQuestObjectiveKey(questId, obj.id);
            if (!quests.completedObjectives.includes(objectiveKey)) {
              quests.completedObjectives.push(objectiveKey);
              this.context.addLog(`Reached objective area: ${obj.description}`);
            }
          }
        }
      }
    }
  }

  recordNpcDefeat(npcId: string): void {
    const quests = this.context.getPlayerQuests();

    for (const questId of quests.active) {
      const questDef = getQuestDef(questId);
      if (!questDef) continue;

      for (const obj of questDef.objectives) {
        if (obj.type !== "defeat_npc" || obj.npcId !== npcId) {
          continue;
        }

        const objectiveKey = getQuestObjectiveKey(questId, obj.id);
        if (!quests.completedObjectives.includes(objectiveKey)) {
          quests.completedObjectives.push(objectiveKey);
          this.context.addLog(`Completed objective: ${obj.description}`);
        }
      }
    }
  }
}

function filterKnownQuestIds(
  questIds: string[],
  unknownQuestIds: Set<string>,
): string[] {
  const knownQuestIds: string[] = [];
  const seenQuestIds = new Set<string>();

  for (const questId of questIds) {
    if (!hasQuestDef(questId)) {
      unknownQuestIds.add(questId);
      continue;
    }

    if (seenQuestIds.has(questId)) {
      continue;
    }

    knownQuestIds.push(questId);
    seenQuestIds.add(questId);
  }

  return knownQuestIds;
}

export function normalizeCompletedObjectiveKeys(
  savedObjectiveIds: string[],
  activeQuestIds: string[],
): string[] {
  const candidates = activeQuestIds.flatMap((questId) => {
    const questDef = getQuestDef(questId);
    if (!questDef) return [];

    return questDef.objectives.map((objective) => ({
      objectiveId: objective.id,
      key: getQuestObjectiveKey(questId, objective.id),
    }));
  });
  const knownKeys = new Set(candidates.map((candidate) => candidate.key));
  const normalized = new Set<string>();

  for (const savedObjectiveId of savedObjectiveIds) {
    if (knownKeys.has(savedObjectiveId)) {
      normalized.add(savedObjectiveId);
      continue;
    }

    const legacyMatches = candidates.filter(
      (candidate) => candidate.objectiveId === savedObjectiveId,
    );
    if (legacyMatches.length === 1) {
      normalized.add(legacyMatches[0].key);
    }
  }

  return [...normalized];
}

export function hasCompletedQuestObjective(
  quests: Quests,
  questId: string,
  objectiveId: string,
): boolean {
  return quests.completedObjectives.includes(
    getQuestObjectiveKey(questId, objectiveId),
  );
}

function getQuestObjectiveKey(questId: string, objectiveId: string): string {
  return `${questId}:${objectiveId}`;
}

function formatCurrencyReward(copperCoins: number): string {
  const platinum = Math.floor(copperCoins / 1_000_000);
  const gold = Math.floor((copperCoins % 1_000_000) / 10_000);
  const silver = Math.floor((copperCoins % 10_000) / 100);
  const copper = copperCoins % 100;

  const parts: string[] = [];
  if (platinum > 0) parts.push(`${platinum}p`);
  if (gold > 0) parts.push(`${gold}g`);
  if (silver > 0) parts.push(`${silver}s`);
  if (copper > 0 || parts.length === 0) parts.push(`${copper}c`);

  return parts.join(" ");
}
