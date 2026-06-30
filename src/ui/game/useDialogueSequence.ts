import { useCallback, useEffect, useState } from "react";
import type { AudioSettings } from "../audio/audioSettings";
import { playTextBleepSound } from "../audio/menuAudio";
import type { TextSpeed } from "../controls/textSpeed";
import type { DialogueNode } from "./dialogueTypes";

type UseDialogueSequenceInput = {
  audioSettings: AudioSettings;
  textSpeed: TextSpeed;
};

export function useDialogueSequence({
  audioSettings,
  textSpeed,
}: UseDialogueSequenceInput) {
  const [activeDialogue, setActiveDialogue] = useState<DialogueNode[] | null>(
    null,
  );
  const [dialogueIndex, setDialogueIndex] = useState(0);
  const [visibleText, setVisibleText] = useState("");
  const [isTyping, setIsTyping] = useState(false);

  const closeDialogue = useCallback(() => {
    setActiveDialogue(null);
    setDialogueIndex(0);
    setVisibleText("");
    setIsTyping(false);
  }, []);

  const triggerDialogue = useCallback((nodes: DialogueNode[]) => {
    setActiveDialogue(nodes);
    setDialogueIndex(0);
    setVisibleText("");
    setIsTyping(true);
  }, []);

  const progressDialogue = useCallback(() => {
    if (!activeDialogue) return;

    const node = activeDialogue[dialogueIndex];
    if (!node) return;

    if (isTyping) {
      setVisibleText(node.text);
      setIsTyping(false);
      return;
    }

    const nextIndex = dialogueIndex + 1;
    if (nextIndex < activeDialogue.length) {
      setDialogueIndex(nextIndex);
      setVisibleText("");
      setIsTyping(true);
      return;
    }

    closeDialogue();
  }, [activeDialogue, closeDialogue, dialogueIndex, isTyping]);

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
    closeDialogue,
    dialogueIndex,
    isTyping,
    progressDialogue,
    triggerDialogue,
    visibleText,
  };
}

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
