import { useEffect, useState } from "react";
import type { AudioSettings } from "../audio/audioSettings";
import { playMenuConfirmSound, playMenuMoveSound } from "../audio/menuAudio";
import { consumeIfPointerOverKeyboardBlockingElement } from "../menu/pointerKeyboardBlock";

type UseMenuKeyboardOptions = {
  itemCount: number;
  audioSettings: AudioSettings;
  enableDirectionalLetterKeys?: boolean;
  onConfirm?: (selectedIndex: number) => void;
  onCancel?: () => void;
  extraKeys?: Record<string, (selectedIndex: number) => void>;
  initialIndex?: number;
};

export type MenuKeyAction =
  | { kind: "cancel" }
  | { kind: "move"; direction: -1 | 1 }
  | { kind: "confirm" }
  | { kind: "extra"; key: string }
  | { kind: "none" };

type ResolveMenuKeyOptions = {
  itemCount: number;
  enableDirectionalLetterKeys: boolean;
  hasCancel: boolean;
  extraKeys?: string[];
};

/**
 * Pure key → menu-action resolution. Any action other than "none" is a
 * HANDLED key: the hook consumes it (preventDefault + stopPropagation) so
 * it never reaches the global window listener. Without stopPropagation,
 * closing a menu re-registers the global handler synchronously and the
 * same keydown falls through to it (e.g. Escape in the inventory used to
 * close it AND open the pause menu).
 */
export function resolveMenuKeyAction(
  key: string,
  options: ResolveMenuKeyOptions,
): MenuKeyAction {
  if (key === "Escape") {
    return options.hasCancel ? { kind: "cancel" } : { kind: "none" };
  }

  if (options.itemCount <= 0) return { kind: "none" };

  const keyLower = key.toLowerCase();

  if (
    key === "ArrowDown" ||
    (options.enableDirectionalLetterKeys && keyLower === "s")
  ) {
    return { kind: "move", direction: 1 };
  }
  if (
    key === "ArrowUp" ||
    (options.enableDirectionalLetterKeys &&
      (keyLower === "z" || keyLower === "w"))
  ) {
    return { kind: "move", direction: -1 };
  }
  if (key === "Enter") {
    return { kind: "confirm" };
  }
  if (options.extraKeys?.includes(keyLower)) {
    return { kind: "extra", key: keyLower };
  }
  return { kind: "none" };
}

/**
 * A universal hook to manage keyboard navigation for menus and selection
 * lists. Handles ArrowUp/ArrowDown, optional Z/S/W/S movement keys, Enter
 * confirmation, Escape cancellation, and menu sound cues.
 */
export function useMenuKeyboard({
  itemCount,
  audioSettings,
  enableDirectionalLetterKeys = true,
  onConfirm,
  onCancel,
  extraKeys,
  initialIndex = 0,
}: UseMenuKeyboardOptions) {
  const [selectedIndex, setSelectedIndex] = useState(initialIndex);

  // Sync selected index when initialIndex changes
  useEffect(() => {
    setSelectedIndex(initialIndex);
  }, [initialIndex]);

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
    const action = resolveMenuKeyAction(e.key, {
      itemCount,
      enableDirectionalLetterKeys,
      hasCancel: onCancel !== undefined,
      extraKeys: extraKeys ? Object.keys(extraKeys) : undefined,
    });
    if (action.kind === "none") return;

    if (
      action.kind !== "cancel" &&
      consumeIfPointerOverKeyboardBlockingElement(e)
    ) {
      return;
    }

    e.preventDefault();
    e.stopPropagation();

    switch (action.kind) {
      case "cancel":
        if (audioSettings.soundEnabled) {
          playMenuConfirmSound();
        }
        onCancel?.();
        break;
      case "move":
        moveSelection(action.direction);
        break;
      case "confirm":
        if (onConfirm) {
          if (audioSettings.soundEnabled) {
            playMenuConfirmSound();
          }
          onConfirm(selectedIndex);
        }
        break;
      case "extra":
        extraKeys?.[action.key]?.(selectedIndex);
        break;
    }
  };

  return {
    selectedIndex,
    setSelectedIndex,
    handleKeyDown,
  };
}
