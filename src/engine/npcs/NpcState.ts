import { getAllNpcDefs } from "./npcRegistry";

/**
 * Mutable, saveable progress for a character.
 *
 * Static identity lives in NpcDef. This state is keyed by npcId and is where
 * long-term simulation can store relationships, role changes, progression, and
 * dialogue overrides.
 */
export interface NpcState {
  npcId: string;
  relationship: number;
  progressionLevel: number;
  currentRole: string;
  currentDialogueId?: string;
  knownFlags: string[];
}

/**
 * Save/runtime lookup of mutable NPC state by stable npcId.
 */
export type NpcStateMap = Record<string, NpcState>;

/**
 * Creates the default mutable state for a known character id.
 */
export function createInitialNpcState(npcId: string): NpcState {
  return {
    npcId,
    relationship: 0,
    progressionLevel: 1,
    currentRole: "resident",
    knownFlags: [],
  };
}

/**
 * Returns a detached copy so callers cannot mutate engine-owned state by
 * editing snapshots or save payloads.
 */
export function cloneNpcState(state: NpcState): NpcState {
  return {
    ...state,
    knownFlags: [...state.knownFlags],
  };
}

/**
 * Deep-clones an NPC state map while preserving each npcId key.
 */
export function cloneNpcStateMap(states: NpcStateMap): NpcStateMap {
  return Object.fromEntries(
    Object.entries(states).map(([npcId, state]) => [
      npcId,
      cloneNpcState(state),
    ]),
  );
}

/**
 * Builds default state for every currently registered NPC definition.
 */
export function createInitialNpcStateMap(): NpcStateMap {
  return Object.fromEntries(
    getAllNpcDefs().map((npcDef) => [
      npcDef.npcId,
      createInitialNpcState(npcDef.npcId),
    ]),
  );
}

/**
 * Restores saved NPC state on top of the current registry defaults.
 *
 * This lets new NPC definitions gain default state after an older save is
 * loaded, while saved characters keep their persisted progress.
 */
export function createNpcStateMapFromSave(savedStates: NpcState[]): NpcStateMap {
  const nextStateMap = createInitialNpcStateMap();

  for (const state of savedStates) {
    nextStateMap[state.npcId] = cloneNpcState(state);
  }

  return nextStateMap;
}
