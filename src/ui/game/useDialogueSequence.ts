import { useCallback, useEffect, useState } from "react";
import type { AudioSettings } from "../audio/audioSettings";
import { playTextBleepSound } from "../audio/menuAudio";
import type { TextSpeed } from "../controls/textSpeed";
import type { DialogueNode } from "./dialogueTypes";

type UseDialogueSequenceInput = {
  audioSettings: AudioSettings;
  textSpeed: TextSpeed;
  onDialogueComplete?: () => void;
};

/**
 * Manages progressive dialogue text, dialogue advancement, and per-character bleeps.
 */
export function useDialogueSequence({
  audioSettings,
  textSpeed,
  onDialogueComplete,
}: UseDialogueSequenceInput) {
  const [activeDialogue, setActiveDialogue] = useState<DialogueNode[] | null>(
    null,
  );
  const [activeDialogueId, setActiveDialogueId] = useState<string | null>(null);
  const [dialogueIndex, setDialogueIndex] = useState(0);
  const [visibleText, setVisibleText] = useState("");
  const [isTyping, setIsTyping] = useState(false);

  const closeDialogue = useCallback(() => {
    setActiveDialogue(null);
    setActiveDialogueId(null);
    setDialogueIndex(0);
    setVisibleText("");
    setIsTyping(false);
  }, []);

  const triggerDialogue = useCallback((nodes: DialogueNode[], dialogueId?: string) => {
    setActiveDialogue(nodes);
    setActiveDialogueId(dialogueId ?? null);
    setDialogueIndex(0);
    setVisibleText("");
    setIsTyping(true);
  }, []);

  const skipDialogueLine = useCallback(() => {
    if (!activeDialogue) return;

    const node = activeDialogue[dialogueIndex];
    if (!node) return;

    setVisibleText(node.text);
    setIsTyping(false);
  }, [activeDialogue, dialogueIndex]);

  const progressDialogue = useCallback(() => {
    if (!activeDialogue) return;

    const node = activeDialogue[dialogueIndex];
    if (!node) return;

    if (isTyping) {
      skipDialogueLine();
      return;
    }

    const nextIndex = dialogueIndex + 1;
    if (nextIndex < activeDialogue.length) {
      setDialogueIndex(nextIndex);
      setVisibleText("");
      setIsTyping(true);
      return;
    }

    if (activeDialogueId && onDialogueComplete) {
      onDialogueComplete();
    }
    closeDialogue();
  }, [
    activeDialogue,
    activeDialogueId,
    closeDialogue,
    dialogueIndex,
    isTyping,
    onDialogueComplete,
    skipDialogueLine,
  ]);

  useEffect(() => {
    if (!activeDialogue) return;

    const node = activeDialogue[dialogueIndex];
    if (!node) {
      closeDialogue();
      return;
    }

    if (visibleText.length >= node.text.length) {
      setIsTyping(false);
      return;
    }

    const delay = getTextDelay(textSpeed);

    if (delay === 0) {
      setVisibleText(node.text);
      setIsTyping(false);
      return;
    }

    const timer = setTimeout(() => {
      const nextChar = node.text[visibleText.length];
      setVisibleText((prev) => prev + nextChar);

      if (nextChar !== " " && audioSettings.soundEnabled) {
        playTextBleepSound(node.pitch);
      }
    }, delay);

    return () => clearTimeout(timer);
  }, [
    activeDialogue,
    audioSettings.soundEnabled,
    closeDialogue,
    dialogueIndex,
    textSpeed,
    visibleText,
  ]);

  return {
    activeDialogue,
    activeDialogueId,
    closeDialogue,
    dialogueIndex,
    isTyping,
    progressDialogue,
    skipDialogueLine,
    triggerDialogue,
    visibleText,
  };
}

/**
 * Converts the stored text speed option into a per-character delay in milliseconds.
 */
function getTextDelay(textSpeed: TextSpeed): number {
  if (textSpeed === "slow") {
    return 60;
  }

  if (textSpeed === "fast") {
    return 10;
  }

  if (textSpeed === "instant") {
    return 0;
  }

  return 30;
}
