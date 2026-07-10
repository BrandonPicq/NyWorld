export interface EventArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type EventTrigger =
  | { type: "enter_zone"; zoneId: string }
  | { type: "step_on_area"; zoneId: string; area: EventArea }
  | { type: "interact_on_area"; zoneId: string; area: EventArea }
  | { type: "dialogue_end"; dialogueId?: string }
  | { type: "quest_state_change"; questId: string; state: EventQuestState }
  | { type: "calendar_time"; day?: number; minutes: number };

export type EventQuestState =
  | "not_started"
  | "active"
  | "readyToComplete"
  | "completed";

export type EventCondition =
  | { type: "quest_state"; questId: string; state: EventQuestState }
  | { type: "world_flag"; flag: string; value: boolean }
  | { type: "has_item"; itemId: string; quantity: number }
  | { type: "min_global_level"; level: number }
  | { type: "time_window"; startMinutes: number; endMinutes: number };

export type EventAction =
  | { type: "dialogue"; dialogueId: string }
  | { type: "grant_xp"; amount: number }
  | { type: "grant_gold"; amount: number }
  | { type: "remove_gold"; amount: number }
  | { type: "give_item"; itemId: string; quantity: number }
  | { type: "remove_item"; itemId: string; quantity: number }
  | { type: "set_flag"; flag: string }
  | { type: "clear_flag"; flag: string }
  | { type: "notice"; message: string }
  | { type: "spawn_enemy"; enemyId: string; x: number; y: number }
  | { type: "despawn_enemy"; enemyId: string }
  | { type: "spawn_npc"; npcId: string; x: number; y: number; dialogueId?: string }
  | { type: "despawn_npc"; npcId: string }
  | { type: "start_combat"; enemyId: string }
  | { type: "teleport"; zoneId: string; x: number; y: number }
  | { type: "set_respawn"; zoneId: string; x: number; y: number }
  | { type: "reveal_area"; zoneId: string; x: number; y: number; width: number; height: number }
  | { type: "start_quest"; questId: string }
  | { type: "advance_quest"; questId: string };

export type EventRepeatPolicy =
  | "once_per_playthrough"
  | "once_per_visit"
  | { type: "cooldown"; ticks: number };

export interface EventDef {
  eventId: string;
  trigger: EventTrigger;
  conditions: EventCondition[];
  actions: EventAction[];
  repeatPolicy: EventRepeatPolicy;
  priority: number;
}

export type EventDefMap = Record<string, EventDef>;
