import type { DialogueNode, Inventory, Position, Stats } from "../components";
import type { GameSaveData } from "../GameSaveData";
import type { LogEntry } from "../LogEntry";
import { getDialogue } from "../dialogues/dialogueRegistry";
import type { EventAction, EventCondition, EventDef, EventRepeatPolicy } from "./EventDef";

export interface EventSystemResult {
  success?: boolean;
  dialogue?: DialogueNode[];
  dialogueId?: string;
  dialogueBlocking?: boolean;
  effects?: Array<
    | { type: "ItemCollected"; itemId: string; quantity: number; source: "event" }
    | { type: "ItemLost"; itemId: string; quantity: number; source: "event" }
  >;
}

export interface EventSystemContext {
  getZoneId: () => string;
  getPlayerPosition: () => Position;
  getPlayerInventory: () => Inventory;
  getPlayerStats: () => Stats;
  getGlobalLevel: () => number;
  getWorldTimeMinutes: () => number;
  getTick: () => number;
  getQuestState: (questId: string) => "not_started" | "active" | "readyToComplete" | "completed";
  getQuestIds: () => { active: readonly string[]; completed: readonly string[] };
  awardXp: (amount: number, source: string) => void;
  addCurrency: (amount: number) => void;
  giveItem: (itemId: string, quantity: number) => EventSystemResult["effects"];
  removeItem: (itemId: string, quantity: number) => EventSystemResult["effects"];
  setFlagNotice: (flag: string, value: boolean) => void;
  addLog: (message: string) => void;
  addNotice: (message: string) => void;
  startDialogue: (dialogueId: string, nodes: DialogueNode[]) => void;
  startQuest: (questId: string) => void;
  advanceQuest: (questId: string) => void;
  spawnEnemy: (enemyId: string, x: number, y: number) => boolean;
  despawnEnemy: (enemyId: string) => boolean;
  spawnNpc: (npcId: string, x: number, y: number, dialogueId?: string) => boolean;
  despawnNpc: (npcId: string) => boolean;
  startCombat: (enemyId: string) => EventSystemResult;
  teleport: (zoneId: string, x: number, y: number) => boolean;
}

export interface EventRuntimeState {
  worldFlags: string[];
  firedEventIds: string[];
  eventCooldowns: Record<string, number>;
  zoneVisitEventIds: string[];
}

type QueuedEvent = { event: EventDef; actionIndex: number };

export class EventSystem {
  private readonly events: readonly EventDef[];
  private readonly context: EventSystemContext;
  private readonly worldFlags = new Set<string>();
  private readonly firedEventIds = new Set<string>();
  private readonly zoneVisitEventIds = new Set<string>();
  private eventCooldowns: Record<string, number> = {};
  private actionQueue: QueuedEvent[] = [];
  private waitingForDialogue = false;

  constructor(events: readonly EventDef[], context: EventSystemContext, saved?: Partial<EventRuntimeState>) {
    this.context = context;
    this.events = events.map(cloneEvent);
    saved?.worldFlags?.forEach((flag) => this.worldFlags.add(flag));
    saved?.firedEventIds?.forEach((eventId) => this.firedEventIds.add(eventId));
    saved?.zoneVisitEventIds?.forEach((eventId) => this.zoneVisitEventIds.add(eventId));
    this.eventCooldowns = { ...(saved?.eventCooldowns ?? {}) };
  }

  onEnterZone(): EventSystemResult {
    this.zoneVisitEventIds.clear();
    return this.trigger((event) => event.trigger.type === "enter_zone" && event.trigger.zoneId === this.context.getZoneId());
  }

  onStep(): EventSystemResult {
    return this.trigger((event) => {
      if (event.trigger.type !== "step_on_area" || event.trigger.zoneId !== this.context.getZoneId()) return false;
      return isInsideArea(this.context.getPlayerPosition(), event.trigger.area);
    });
  }

  onInteract(): EventSystemResult {
    return this.trigger((event) => {
      if (event.trigger.type !== "interact_on_area" || event.trigger.zoneId !== this.context.getZoneId()) return false;
      return isInsideArea(this.context.getPlayerPosition(), event.trigger.area);
    });
  }

  resumeAfterDialogue(): EventSystemResult {
    if (!this.waitingForDialogue) return emptyResult();
    this.waitingForDialogue = false;
    return this.processQueue();
  }

  restoreState(saved: Partial<EventRuntimeState>): void {
    this.worldFlags.clear();
    this.firedEventIds.clear();
    this.zoneVisitEventIds.clear();
    saved.worldFlags?.forEach((flag) => this.worldFlags.add(flag));
    saved.firedEventIds?.forEach((eventId) => this.firedEventIds.add(eventId));
    saved.zoneVisitEventIds?.forEach((eventId) => this.zoneVisitEventIds.add(eventId));
    this.eventCooldowns = { ...(saved.eventCooldowns ?? {}) };
    this.actionQueue = [];
    this.waitingForDialogue = false;
  }

  getState(): EventRuntimeState {
    return {
      worldFlags: [...this.worldFlags].sort(),
      firedEventIds: [...this.firedEventIds].sort(),
      eventCooldowns: { ...this.eventCooldowns },
      zoneVisitEventIds: [...this.zoneVisitEventIds].sort(),
    };
  }

  hasFlag(flag: string): boolean { return this.worldFlags.has(flag); }

  private trigger(matches: (event: EventDef) => boolean): EventSystemResult {
    const eligible = this.events
      .filter((event) => matches(event) && this.canTrigger(event) && this.conditionsPass(event.conditions))
      .sort((a, b) => b.priority - a.priority || a.eventId.localeCompare(b.eventId));

    for (const event of eligible) {
      this.markTriggered(event);
      this.actionQueue.push({ event, actionIndex: 0 });
    }
    return this.processQueue();
  }

  private canTrigger(event: EventDef): boolean {
    if (event.repeatPolicy === "once_per_playthrough") return !this.firedEventIds.has(event.eventId);
    if (event.repeatPolicy === "once_per_visit") return !this.zoneVisitEventIds.has(event.eventId);
    return (this.eventCooldowns[event.eventId] ?? 0) <= this.context.getTick();
  }

  private markTriggered(event: EventDef): void {
    if (event.repeatPolicy === "once_per_playthrough") this.firedEventIds.add(event.eventId);
    if (event.repeatPolicy === "once_per_visit") this.zoneVisitEventIds.add(event.eventId);
    if (isCooldownPolicy(event.repeatPolicy)) this.eventCooldowns[event.eventId] = this.context.getTick() + event.repeatPolicy.ticks;
  }

  private conditionsPass(conditions: readonly EventCondition[]): boolean {
    const timeOfDay = ((this.context.getWorldTimeMinutes() % 1440) + 1440) % 1440;
    return conditions.every((condition) => {
      switch (condition.type) {
        case "quest_state": return this.context.getQuestState(condition.questId) === condition.state;
        case "world_flag": return this.worldFlags.has(condition.flag) === condition.value;
        case "has_item": return this.context.getPlayerInventory().items.filter((item) => item.itemId === condition.itemId).reduce((sum, item) => sum + item.quantity, 0) >= condition.quantity;
        case "min_global_level": return this.context.getGlobalLevel() >= condition.level;
        case "time_window": return condition.startMinutes <= condition.endMinutes ? timeOfDay >= condition.startMinutes && timeOfDay <= condition.endMinutes : timeOfDay >= condition.startMinutes || timeOfDay <= condition.endMinutes;
      }
    });
  }

  private processQueue(): EventSystemResult {
    const result = emptyResult();
    while (this.actionQueue.length > 0) {
      const current = this.actionQueue[0];
      const action = current.event.actions[current.actionIndex];
      if (!action) {
        this.actionQueue.shift();
        continue;
      }

      current.actionIndex += 1;
      const actionResult = this.executeAction(action, current.event.eventId);
      if (actionResult.success) result.success = true;
      if (actionResult.effects) result.effects = [...(result.effects ?? []), ...actionResult.effects];
      if (actionResult.dialogue) {
        this.waitingForDialogue = true;
        result.dialogue = actionResult.dialogue;
        result.dialogueId = actionResult.dialogueId;
        result.dialogueBlocking = true;
        return result;
      }
    }
    return result;
  }

  private executeAction(action: EventAction, eventId: string): EventSystemResult {
    switch (action.type) {
      case "dialogue": {
        const nodes = getDialogue(action.dialogueId);
        this.context.startDialogue(action.dialogueId, nodes);
        return { dialogue: nodes, dialogueId: action.dialogueId };
      }
      case "grant_xp": this.context.awardXp(action.amount, `event ${eventId}`); return emptyResult();
      case "grant_gold": this.context.addCurrency(action.amount); return emptyResult();
      case "remove_gold": this.context.addCurrency(-action.amount); return emptyResult();
      case "give_item": return { effects: this.context.giveItem(action.itemId, action.quantity) };
      case "remove_item": return { effects: this.context.removeItem(action.itemId, action.quantity) };
      case "set_flag": this.worldFlags.add(action.flag); this.context.setFlagNotice(action.flag, true); return emptyResult();
      case "clear_flag": this.worldFlags.delete(action.flag); this.context.setFlagNotice(action.flag, false); return emptyResult();
      case "notice": this.context.addLog(action.message); this.context.addNotice(action.message); return emptyResult();
      case "start_quest": this.context.startQuest(action.questId); return emptyResult();
      case "advance_quest": this.context.advanceQuest(action.questId); return emptyResult();
      case "spawn_enemy": this.context.spawnEnemy(action.enemyId, action.x, action.y); return emptyResult();
      case "despawn_enemy": this.context.despawnEnemy(action.enemyId); return emptyResult();
      case "spawn_npc": this.context.spawnNpc(action.npcId, action.x, action.y, action.dialogueId); return emptyResult();
      case "despawn_npc": this.context.despawnNpc(action.npcId); return emptyResult();
      case "start_combat": return this.context.startCombat(action.enemyId);
      case "teleport": this.context.teleport(action.zoneId, action.x, action.y); return emptyResult();
    }
  }
}

function emptyResult(): EventSystemResult { return {}; }

function isInsideArea(position: Position, area: { x: number; y: number; width: number; height: number }): boolean {
  return position.x >= area.x && position.x < area.x + area.width && position.y >= area.y && position.y < area.y + area.height;
}

function isCooldownPolicy(policy: EventRepeatPolicy): policy is { type: "cooldown"; ticks: number } {
  return typeof policy !== "string";
}

function cloneEvent(event: EventDef): EventDef {
  return {
    ...event,
    trigger: event.trigger.type === "step_on_area" || event.trigger.type === "interact_on_area" ? { ...event.trigger, area: { ...event.trigger.area } } : { ...event.trigger },
    conditions: event.conditions.map((condition) => ({ ...condition })),
    actions: event.actions.map((action) => ({ ...action })),
    repeatPolicy: typeof event.repeatPolicy === "string" ? event.repeatPolicy : { ...event.repeatPolicy },
  };
}
