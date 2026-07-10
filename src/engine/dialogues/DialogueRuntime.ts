import type { DialogueNode } from "../components";
import type { EventSystemResult } from "../events/EventSystem";
import type { GameMap } from "../GameMap";

export type DialogueRuntimeSnapshot = {
  entryDialogue: DialogueNode[];
  eventDialogue: DialogueNode[];
  eventDialogueId?: string;
};

/**
 * Owns transient dialogue state and one-shot zone entry tracking.
 *
 * Dialogue text remains authored content; this runtime only tracks which
 * sequence is waiting for the player and whether it blocks gameplay commands.
 */
export class DialogueRuntime {
  private pendingNpcDialogueCompletionId?: string;
  private pendingZoneEntryDialogue: DialogueNode[] = [];
  private pendingEventDialogue: DialogueNode[] = [];
  private pendingEventDialogueId?: string;
  private pendingEventDialogueBlocking = false;
  private seenZoneEntryEventIds = new Set<string>();

  get isEventDialogueBlocking(): boolean {
    return this.pendingEventDialogueBlocking;
  }

  acknowledgeZoneEntry(): boolean {
    if (this.pendingZoneEntryDialogue.length === 0) return false;
    this.pendingZoneEntryDialogue = [];
    return true;
  }

  setNpcDialogueCompletion(dialogueId: string): void {
    this.pendingNpcDialogueCompletionId = dialogueId;
  }

  consumeNpcDialogueCompletion(): string | undefined {
    const dialogueId = this.pendingNpcDialogueCompletionId;
    this.pendingNpcDialogueCompletionId = undefined;
    return dialogueId;
  }

  queueZoneEntry(map: GameMap): void {
    if (map.entryDialogue.length === 0) {
      this.pendingZoneEntryDialogue = [];
      return;
    }

    const eventId = getZoneEntryEventId(map.zoneId);
    if (this.seenZoneEntryEventIds.has(eventId)) {
      this.pendingZoneEntryDialogue = [];
      return;
    }

    this.seenZoneEntryEventIds.add(eventId);
    this.pendingZoneEntryDialogue = cloneDialogueNodes(map.entryDialogue);
  }

  applyEventResult(result: EventSystemResult): void {
    if (!result.dialogue) return;
    this.pendingEventDialogue = cloneDialogueNodes(result.dialogue);
    this.pendingEventDialogueId = result.dialogueId;
    this.pendingEventDialogueBlocking = result.dialogueBlocking ?? false;
  }

  /** Clears one blocking event sequence and returns its hook id, if any. */
  completeEventDialogue(): { wasBlocking: boolean; dialogueId?: string } {
    if (!this.pendingEventDialogueBlocking) return { wasBlocking: false };

    const dialogueId = this.pendingEventDialogueId;
    this.pendingEventDialogueBlocking = false;
    this.pendingEventDialogue = [];
    this.pendingEventDialogueId = undefined;
    return { wasBlocking: true, dialogueId };
  }

  restoreSeenZoneEntryEventIds(ids: readonly string[] | undefined): void {
    this.seenZoneEntryEventIds = new Set(ids ?? []);
  }

  markZoneEntrySeen(zoneId: string): void {
    this.seenZoneEntryEventIds.add(getZoneEntryEventId(zoneId));
  }

  resetTransientState(): void {
    this.pendingNpcDialogueCompletionId = undefined;
    this.pendingZoneEntryDialogue = [];
    this.pendingEventDialogue = [];
    this.pendingEventDialogueId = undefined;
    this.pendingEventDialogueBlocking = false;
  }

  getSeenZoneEntryEventIds(): string[] {
    return [...this.seenZoneEntryEventIds];
  }

  getSnapshot(): DialogueRuntimeSnapshot {
    return {
      entryDialogue: cloneDialogueNodes(this.pendingZoneEntryDialogue),
      eventDialogue: cloneDialogueNodes(this.pendingEventDialogue),
      eventDialogueId: this.pendingEventDialogueId,
    };
  }
}

function cloneDialogueNodes(dialogues: readonly DialogueNode[]): DialogueNode[] {
  return dialogues.map((dialogue) => ({ ...dialogue }));
}

function getZoneEntryEventId(zoneId: string): string {
  return `zone_entry:${zoneId}`;
}
