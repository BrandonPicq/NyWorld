/**
 * Broad ancestry/species bucket used for common map coloring and future rules.
 */
export type NpcRace = "human" | "elf" | "dwarf" | "orc" | "unknown";

/**
 * Content importance controls whether an NPC can use custom map presentation.
 */
export type NpcImportance = "common" | "notable" | "story";

/**
 * Optional glyph/color override for characters that should stand out on the map.
 */
export interface NpcPresentationOverride {
  glyph: string;
  color: string;
}

/**
 * Stable character sheet for an NPC.
 *
 * Zone files and schedules reference NPCs by npcId. Mutable progress such as
 * relationships, roles, and temporary dialogue overrides lives in NpcState.
 */
export interface NpcDef {
  /** Stable id used by zones, schedules, saves, and dialogue state. */
  npcId: string;
  /** Display name shown in dialogue and UI. */
  name: string;
  /** Race bucket used by presentation helpers and future simulation rules. */
  race: NpcRace;
  /** Defaults to common when omitted. */
  importance?: NpcImportance;
  /** Optional visible override, intended for notable or story characters. */
  presentation?: NpcPresentationOverride;
  /** Dialogue used when no zone or saved state override is active. */
  defaultDialogueId: string;
}

/**
 * Map of NPC ids to character definitions as loaded from content.
 */
export type NpcDefMap = Record<string, NpcDef>;
