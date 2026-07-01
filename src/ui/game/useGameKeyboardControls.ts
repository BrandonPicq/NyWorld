import { useEffect, type Dispatch, type SetStateAction } from "react";
import type { GameCommand } from "../../engine";
import { getGameCommandForKey } from "../controls/gameInput";
import type { KeyboardLayout } from "../controls/keyboardLayout";
import type { DialogueNode } from "./dialogueTypes";

type UseGameKeyboardControlsInput = {
  activeDialogue: DialogueNode[] | null;
  closeDialogue: () => void;
  executeCommand: (command: GameCommand) => void;
  isCharacterSheetOpen: boolean;
  keyboardLayout: KeyboardLayout;
  onBackToTitle: () => void;
  progressDialogue: () => void;
  setIsCharacterSheetOpen: Dispatch<SetStateAction<boolean>>;
};

/**
 * Installs game-screen keyboard shortcuts.
 *
 * Dialogue controls take priority over movement so modal text cannot be skipped
 * accidentally by movement input.
 */
export function useGameKeyboardControls({
  activeDialogue,
  closeDialogue,
  executeCommand,
  isCharacterSheetOpen,
  keyboardLayout,
  onBackToTitle,
  progressDialogue,
  setIsCharacterSheetOpen,
}: UseGameKeyboardControlsInput): void {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const keyLower = event.key.toLowerCase();

      if (activeDialogue) {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          progressDialogue();
        } else if (event.key === "Escape") {
          event.preventDefault();
          closeDialogue();
        }
        return;
      }

      if (keyLower === "c") {
        event.preventDefault();
        setIsCharacterSheetOpen((prev) => !prev);
        return;
      }

      if (event.key === "Escape") {
        event.preventDefault();
        if (isCharacterSheetOpen) {
          setIsCharacterSheetOpen(false);
        } else {
          onBackToTitle();
        }
        return;
      }

      if (isCharacterSheetOpen) {
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
    closeDialogue,
    executeCommand,
    isCharacterSheetOpen,
    keyboardLayout,
    onBackToTitle,
    progressDialogue,
    setIsCharacterSheetOpen,
  ]);
}
