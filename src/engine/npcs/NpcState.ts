export interface NpcState {
  npcId: string;
  relationship: number;
  progressionLevel: number;
  currentRole: string;
  currentDialogueId?: string;
  knownFlags: string[];
}

export type NpcStateMap = Record<string, NpcState>;

export function createInitialNpcState(npcId: string): NpcState {
  return {
    npcId,
    relationship: 0,
    progressionLevel: 1,
    currentRole: "resident",
    knownFlags: [],
  };
}

export function cloneNpcState(state: NpcState): NpcState {
  return {
    ...state,
    knownFlags: [...state.knownFlags],
  };
}

export function cloneNpcStateMap(states: NpcStateMap): NpcStateMap {
  return Object.fromEntries(
    Object.entries(states).map(([npcId, state]) => [
      npcId,
      cloneNpcState(state),
    ]),
  );
}
