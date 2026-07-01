import { useEffect, type Dispatch, type SetStateAction } from "react";
import type { GameCommand } from "../../engine";
import { getGameCommandForKey } from "../controls/gameInput";
import type { KeyboardLayout } from "../controls/keyboardLayout";
import type { AudioSettings } from "../audio/audioSettings";
import { playMenuConfirmSound } from "../audio/menuAudio";
import type { DialogueNode } from "./dialogueTypes";

type UseGameKeyboardControlsInput = {
  activeDialogue: DialogueNode[] | null;
  audioSettings: AudioSettings;
  closeDialogue: () => void;
  executeCommand: (command: GameCommand) => void;
  isCharacterSheetOpen: boolean;
  isInteractChoiceOpen?: boolean;
  isInventoryOpen: boolean;
  keyboardLayout: KeyboardLayout;
  onBackToTitle: () => void;
  progressDialogue: () => void;
  setIsCharacterSheetOpen: Dispatch<SetStateAction<boolean>>;
  setIsInventoryOpen: Dispatch<SetStateAction<boolean>>;
};

/**
 * Installs game-screen keyboard shortcuts.
 *
 * Dialogue controls take priority over movement so modal text cannot be skipped
 * accidentally by movement input.
 */
export function useGameKeyboardControls({
  activeDialogue,
  audioSettings,
  closeDialogue,
  executeCommand,
  isCharacterSheetOpen,
  isInteractChoiceOpen = false,
  isInventoryOpen,
  keyboardLayout,
  onBackToTitle,
  progressDialogue,
  setIsCharacterSheetOpen,
  setIsInventoryOpen,
}: UseGameKeyboardControlsInput): void {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (isInteractChoiceOpen) {
        return;
      }

      const keyLower = event.key.toLowerCase();

      if (activeDialogue) {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          progressDialogue();
        } else if (event.key === "Escape") {
          event.preventDefault();
          if (audioSettings.soundEnabled) {
            playMenuConfirmSound();
          }
          closeDialogue();
        }
        return;
      }

      if (event.key === "Escape") {
        event.preventDefault();
        if (audioSettings.soundEnabled) {
          playMenuConfirmSound();
        }
        if (isCharacterSheetOpen) {
          setIsCharacterSheetOpen(false);
        } else if (isInventoryOpen) {
          setIsInventoryOpen(false);
        } else {
          onBackToTitle();
        }
        return;
      }

      if (keyLower === "c" && !isInventoryOpen) {
        event.preventDefault();
        if (audioSettings.soundEnabled) {
          playMenuConfirmSound();
        }
        setIsCharacterSheetOpen((prev) => !prev);
        return;
      }

      if (keyLower === "i" && !isCharacterSheetOpen) {
        event.preventDefault();
        if (audioSettings.soundEnabled) {
          playMenuConfirmSound();
        }
        setIsInventoryOpen((prev) => !prev);
        return;
      }

      if (isCharacterSheetOpen || isInventoryOpen) {
        return;
      }

      if (keyLower === "r") {
        event.preventDefault();
        executeCommand({ type: "Rest" });
        return;
      }

      const commandType = getGameCommandForKey(event.key, keyboardLayout);

      if (commandType) {
        event.preventDefault();
        executeCommand({ type: commandType });
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    activeDialogue,
    audioSettings,
    closeDialogue,
    executeCommand,
    isCharacterSheetOpen,
    isInteractChoiceOpen,
    isInventoryOpen,
    keyboardLayout,
    onBackToTitle,
    progressDialogue,
    setIsCharacterSheetOpen,
    setIsInventoryOpen,
  ]);
}
