export interface FetchItemObjective {
  readonly type: "fetch_item";
  id: string;
  itemId: string;
  quantity: number;
  description: string;
}

export interface VisitCoordinateObjective {
  readonly type: "visit_coordinate";
  id: string;
  zoneId: string;
  x: number;
  y: number;
  description: string;
}

export interface StatThresholdObjective {
  readonly type: "stat_threshold";
  id: string;
  statName: string;
  threshold: number;
  description: string;
}

export interface DefeatNpcObjective {
  readonly type: "defeat_npc";
  id: string;
  npcId: string;
  quantity: number;
  description: string;
}

export type QuestObjective =
  | FetchItemObjective
  | VisitCoordinateObjective
  | StatThresholdObjective
  | DefeatNpcObjective;

export interface QuestRewards {
  currency?: number;
  items?: Array<{ itemId: string; quantity: number }>;
}

export interface QuestTriggers {
  start: { dialogueId: string };
  complete: { dialogueId: string };
}

export interface QuestNpcOverride {
  active?: string;
  activeReady?: string;
  completed?: string;
}

export interface QuestDef {
  questId: string;
  name: string;
  description: string;
  targetNpcId: string;
  triggers: QuestTriggers;
  npcOverrides: Record<string, QuestNpcOverride>;
  objectives: QuestObjective[];
  rewards: QuestRewards;
}

export type QuestDefMap = Record<string, QuestDef>;
