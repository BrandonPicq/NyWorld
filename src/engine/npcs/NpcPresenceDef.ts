import type { NpcScheduleEntryData } from "../ZoneTypes";

/**
 * Global daily presence plan for an NPC.
 *
 * Unlike zone-local spawns, this can move a character between zones over time.
 * The engine derives the currently active appearance from the world clock.
 */
export interface NpcPresenceDef {
  /** Stable character id from the NPC registry. */
  npcId: string;
  /** Ordered daily positions and optional dialogue overrides. */
  schedule: NpcScheduleEntryData[];
}

/**
 * Map of NPC ids to global presence definitions as loaded from content.
 */
export type NpcPresenceDefMap = Record<string, NpcPresenceDef>;
