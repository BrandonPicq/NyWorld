import { useEffect, useRef } from "react";
import type { GameSnapshot } from "../../engine";
import type { DialogueNode } from "./dialogueTypes";

/**
 * Triggers the pending one-shot zone entry dialogue when the engine exposes it.
 */
export function useZoneEntryDialogue(
  snapshot: GameSnapshot | null,
  triggerDialogue: (nodes: DialogueNode[]) => void,
  triggerEventDialogue?: (nodes: DialogueNode[], dialogueId?: string) => void,
): void {
  const prevZoneIdRef = useRef<string | null>(null);
  const prevEventDialogueIdRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (!snapshot) return;

    const zoneChanged = prevZoneIdRef.current !== snapshot.zoneId;
    prevZoneIdRef.current = snapshot.zoneId;

    if (zoneChanged && snapshot.entryDialogue.length > 0) {
      triggerDialogue(snapshot.entryDialogue);
    }
    if (
      snapshot.eventDialogue &&
      snapshot.eventDialogue.length > 0 &&
      snapshot.eventDialogueId !== prevEventDialogueIdRef.current
    ) {
      prevEventDialogueIdRef.current = snapshot.eventDialogueId;
      triggerEventDialogue?.(snapshot.eventDialogue, snapshot.eventDialogueId);
    }
  }, [snapshot, triggerDialogue, triggerEventDialogue]);
}
