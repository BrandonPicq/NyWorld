/**
 * Stable content-type names shared by content diagnostics and cross-content
 * tooling such as the reference graph.
 *
 * Keeping the names in one place lets editor code group diagnostics, build
 * reference queries, and label content families without string drift.
 */
export const CONTENT_TYPES = {
  zone: "zone",
  quest: "quest",
  item: "item",
  tile: "tile",
  npc: "npc",
  npcPresence: "npc-presence",
  enemy: "enemy",
  dialogue: "dialogue",
  combatAction: "combat-action",
  class: "class",
  race: "race",
  commandMastery: "command-mastery",
  game: "game",
} as const;

export type ContentTypeName =
  (typeof CONTENT_TYPES)[keyof typeof CONTENT_TYPES];
