export interface FetchItemObjective {
  readonly type: "fetch_item";
  id: string;
  itemId: string;
  quantity: number;
  description: string;
}

export type QuestObjective = FetchItemObjective;

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
