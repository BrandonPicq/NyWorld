import { useEffect, useRef } from "react";
import type { GameSnapshot } from "../../engine";
import type { DialogueNode } from "./dialogueTypes";

/**
 * Triggers the current zone's entry dialogue once whenever the zone id changes.
 */
export function useZoneEntryDialogue(
  snapshot: GameSnapshot | null,
  triggerDialogue: (nodes: DialogueNode[]) => void,
): void {
  const prevZoneIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!snapshot) return;

    if (prevZoneIdRef.current === snapshot.zoneId) {
      return;
    }

    prevZoneIdRef.current = snapshot.zoneId;

    if (snapshot.entryDialogue.length > 0) {
      triggerDialogue(snapshot.entryDialogue);
    }
  }, [snapshot, triggerDialogue]);
}
