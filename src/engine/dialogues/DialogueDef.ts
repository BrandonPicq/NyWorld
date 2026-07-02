import type { DialogueNodeData } from "../ZoneTypes";

/**
 * Stable id for a reusable dialogue sequence.
 *
 * NPC definitions, zone appearances, schedules, and saved NPC state can all
 * point to dialogue ids.
 */
export type DialogueId = string;

/**
 * Map of dialogue ids to ordered dialogue nodes as loaded from content files.
 */
export type DialogueDefMap = Record<DialogueId, DialogueNodeData[]>;
