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
  executeCommand: (command: GameCommand) => void;
  isCharacterSheetOpen: boolean;
  isInteractChoiceOpen?: boolean;
  isNoticeOpen: boolean;
  isInventoryOpen: boolean;
  isPauseMenuOpen: boolean;
  isQuestsOpen: boolean;
  isSaveSlotsOpen?: boolean;
  isCombatActive?: boolean;
  keyboardLayout: KeyboardLayout;
  onOpenPauseMenu: () => void;
  progressDialogue: () => void;
  skipDialogueLine: () => void;
  setIsCharacterSheetOpen: Dispatch<SetStateAction<boolean>>;
  setIsNoticeOpen: Dispatch<SetStateAction<boolean>>;
  setIsInventoryOpen: Dispatch<SetStateAction<boolean>>;
  setIsQuestsOpen: Dispatch<SetStateAction<boolean>>;
  setIsSaveSlotsOpen?: Dispatch<SetStateAction<boolean>>;
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
  executeCommand,
  isCharacterSheetOpen,
  isInteractChoiceOpen = false,
  isNoticeOpen,
  isInventoryOpen,
  isPauseMenuOpen,
  isQuestsOpen,
  isSaveSlotsOpen = false,
  keyboardLayout,
  onOpenPauseMenu,
  progressDialogue,
  skipDialogueLine,
  setIsCharacterSheetOpen,
  setIsNoticeOpen,
  setIsInventoryOpen,
  setIsQuestsOpen,
  setIsSaveSlotsOpen,
  isCombatActive = false,
}: UseGameKeyboardControlsInput): void {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (isInteractChoiceOpen || isPauseMenuOpen || isSaveSlotsOpen || isCombatActive) {
        return;
      }

      const keyLower = event.key.toLowerCase();

      if (activeDialogue) {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          progressDialogue();
        } else if (event.key === "Escape") {
          event.preventDefault();
          skipDialogueLine();
        }
        return;
      }

      if (event.key === "Escape") {
        event.preventDefault();
        if (audioSettings.soundEnabled) {
          playMenuConfirmSound();
        }
        if (isNoticeOpen) {
          setIsNoticeOpen(false);
        } else if (isCharacterSheetOpen) {
          setIsCharacterSheetOpen(false);
        } else if (isInventoryOpen) {
          setIsInventoryOpen(false);
        } else if (isQuestsOpen) {
          setIsQuestsOpen(false);
        } else {
          onOpenPauseMenu();
        }
        return;
      }

      const journalKey = keyboardLayout === "azerty" ? "a" : "q";
      const commandType = getGameCommandForKey(event.key, keyboardLayout);

      if (isPointerOverKeyboardBlockingElement()) {
        if (
          keyLower === "c" ||
          keyLower === "i" ||
          keyLower === journalKey ||
          keyLower === "r" ||
          keyLower === "t" ||
          commandType
        ) {
          event.preventDefault();
        }
        return;
      }

      if (keyLower === "c" && !isInventoryOpen && !isQuestsOpen) {
        event.preventDefault();
        if (audioSettings.soundEnabled) {
          playMenuConfirmSound();
        }
        setIsCharacterSheetOpen((prev) => !prev);
        return;
      }

      if (keyLower === "i" && !isCharacterSheetOpen && !isQuestsOpen) {
        event.preventDefault();
        if (audioSettings.soundEnabled) {
          playMenuConfirmSound();
        }
        setIsInventoryOpen((prev) => !prev);
        return;
      }

      if (keyLower === journalKey && !isInventoryOpen && !isCharacterSheetOpen) {
        event.preventDefault();
        if (audioSettings.soundEnabled) {
          playMenuConfirmSound();
        }
        setIsQuestsOpen((prev) => !prev);
        return;
      }

      if (isCharacterSheetOpen || isInventoryOpen || isQuestsOpen) {
        return;
      }

      if (keyLower === "r") {
        event.preventDefault();
        executeCommand({ type: "Rest" });
        return;
      }

      if (keyLower === "t") {
        event.preventDefault();
        executeCommand({ type: "Study" });
        return;
      }

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
    executeCommand,
    isCharacterSheetOpen,
    isInteractChoiceOpen,
    isNoticeOpen,
    isInventoryOpen,
    isPauseMenuOpen,
    isQuestsOpen,
    isSaveSlotsOpen,
    keyboardLayout,
    onOpenPauseMenu,
    progressDialogue,
    skipDialogueLine,
    setIsCharacterSheetOpen,
    setIsNoticeOpen,
    setIsInventoryOpen,
    setIsQuestsOpen,
  ]);
}

function isPointerOverKeyboardBlockingElement(): boolean {
  if (typeof document === "undefined") {
    return false;
  }

  return (
    document.querySelector(
      '[data-keyboard-blocking-hover="true"]:hover:not(:disabled):not([aria-disabled="true"])',
    ) !== null
  );
}
