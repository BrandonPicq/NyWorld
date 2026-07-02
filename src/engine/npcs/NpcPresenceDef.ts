import type { NpcScheduleEntryData } from "../ZoneTypes";

export interface NpcPresenceDef {
  npcId: string;
  schedule: NpcScheduleEntryData[];
}

export type NpcPresenceDefMap = Record<string, NpcPresenceDef>;
