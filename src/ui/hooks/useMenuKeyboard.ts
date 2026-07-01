import { useEffect, useState } from "react";
import type { AudioSettings } from "../audio/audioSettings";
import { playMenuConfirmSound, playMenuMoveSound } from "../audio/menuAudio";

type UseMenuKeyboardOptions = {
  itemCount: number;
  audioSettings: AudioSettings;
  onConfirm?: (selectedIndex: number) => void;
  onCancel?: () => void;
  extraKeys?: Record<string, (selectedIndex: number) => void>;
};

/**
 * A universal hook to manage keyboard navigation for menus and selection lists.
 * Handles ArrowUp/ArrowDown, Z/S, W/S movement keys, Enter confirmation,
 * Escape cancellation, and menu sound cues.
 */
export function useMenuKeyboard({
  itemCount,
  audioSettings,
  onConfirm,
  onCancel,
  extraKeys,
}: UseMenuKeyboardOptions) {
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Sync selected index with bounds if itemCount shrinks
  useEffect(() => {
    if (selectedIndex >= itemCount) {
      setSelectedIndex(Math.max(0, itemCount - 1));
    }
  }, [itemCount, selectedIndex]);

  const moveSelection = (direction: -1 | 1) => {
    if (itemCount <= 0) return;
    const nextIndex = selectedIndex + direction;
    if (nextIndex >= 0 && nextIndex < itemCount) {
      setSelectedIndex(nextIndex);
      if (audioSettings.soundEnabled) {
        playMenuMoveSound();
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLElement> | KeyboardEvent) => {
    const key = e.key;

    if (key === "Escape") {
      if (onCancel) {
        e.preventDefault();
        if (audioSettings.soundEnabled) {
          playMenuConfirmSound();
        }
        onCancel();
      }
      return;
    }

    if (itemCount <= 0) return;

    const keyLower = key.toLowerCase();

    if (key === "ArrowDown" || keyLower === "s") {
      e.preventDefault();
      moveSelection(1);
    } else if (
      key === "ArrowUp" ||
      keyLower === "z" ||
      keyLower === "w"
    ) {
      e.preventDefault();
      moveSelection(-1);
    } else if (key === "Enter") {
      e.preventDefault();
      if (onConfirm) {
        if (audioSettings.soundEnabled) {
          playMenuConfirmSound();
        }
        onConfirm(selectedIndex);
      }
    } else if (extraKeys && extraKeys[keyLower]) {
      e.preventDefault();
      extraKeys[keyLower](selectedIndex);
    }
  };

  return {
    selectedIndex,
    setSelectedIndex,
    handleKeyDown,
  };
}
