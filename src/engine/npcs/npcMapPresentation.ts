import type { NpcImportance, NpcRace, NpcSpawnData } from "../ZoneTypes";

export interface NpcMapPresentation {
  glyph: string;
  color: string;
}

export const COMMON_NPC_GLYPH = "n";

const RACE_COLORS: Record<NpcRace, string> = {
  human: "#f2cdcd",
  elf: "#a6e3a1",
  dwarf: "#fab387",
  orc: "#94e2d5",
  unknown: "#cdd6f4",
};

/**
 * Returns the map glyph and color for an NPC.
 *
 * Common NPCs always use the shared glyph so a busy zone stays readable.
 * Notable and story NPCs can opt into an explicit presentation override.
 */
export function getNpcMapPresentation(
  npc: Pick<NpcSpawnData, "race" | "importance" | "presentation">,
): NpcMapPresentation {
  const importance = npc.importance ?? "common";

  if (canUsePresentationOverride(importance) && npc.presentation) {
    return {
      glyph: npc.presentation.glyph,
      color: npc.presentation.color,
    };
  }

  return {
    glyph: COMMON_NPC_GLYPH,
    color: RACE_COLORS[npc.race],
  };
}

function canUsePresentationOverride(importance: NpcImportance): boolean {
  return importance === "notable" || importance === "story";
}
