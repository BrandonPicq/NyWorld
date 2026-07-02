import { useState } from "react";
import { formatWorldDateTime } from "../../engine";
import type { GameSaveData } from "../../engine/GameSaveData";
import { TerminalPanel } from "../components/TerminalPanel";
import { TerminalMenu, type TerminalMenuItem } from "../components/TerminalMenu";
import type { AudioSettings } from "../audio/audioSettings";
import { playMenuConfirmSound, playMenuMoveSound } from "../audio/menuAudio";
import { SAVE_SLOT_COUNT } from "./gameSaveStorage";

type SaveSlotsModalProps = {
  audioSettings: AudioSettings;
  onClose: () => void;
  onSave: (slotIndex: number) => void;
  slots: (GameSaveData | null)[];
};

function formatSlotSummary(save: GameSaveData | null, index: number): string {
  if (!save) return `[Slot ${index + 1}] Empty`;

  return `[Slot ${index + 1}] ${save.zoneId} — ${formatWorldDateTime(
    save.worldTimeMinutes,
  )}`;
}

export function SaveSlotsModal({
  audioSettings,
  onClose,
  onSave,
  slots,
}: SaveSlotsModalProps) {
  const [pendingOverwriteIndex, setPendingOverwriteIndex] = useState<
    number | null
  >(null);
  const pendingOverwriteSave =
    pendingOverwriteIndex !== null ? slots[pendingOverwriteIndex] : null;

  const playConfirmFeedback = () => {
    if (audioSettings.soundEnabled) {
      playMenuConfirmSound();
    }
  };

  const menuFeedback = {
    onActivateItem: playConfirmFeedback,
    onMoveSelection: () => {
      if (audioSettings.soundEnabled) {
        playMenuMoveSound();
      }
    },
  };

  const handleOverlayClose = () => {
    playConfirmFeedback();
    onClose();
  };

  const handleKeyboardBack = () => {
    if (pendingOverwriteIndex !== null) {
      setPendingOverwriteIndex(null);
      return;
    }

    onClose();
  };

  const handleSelectSlot = (slotIndex: number) => {
    if (slots[slotIndex]) {
      setPendingOverwriteIndex(slotIndex);
      return;
    }

    onSave(slotIndex);
  };

  const handleConfirmOverwrite = () => {
    if (pendingOverwriteIndex === null) {
      return;
    }

    const slotIndex = pendingOverwriteIndex;
    setPendingOverwriteIndex(null);
    onSave(slotIndex);
  };

  const slotMenuItems: TerminalMenuItem[] = [
    ...Array.from({ length: SAVE_SLOT_COUNT }, (_, i) => ({
      label: formatSlotSummary(slots[i], i),
      onSelect: () => handleSelectSlot(i),
    })),
    { label: "Cancel", onSelect: onClose },
  ];

  const overwriteMenuItems: TerminalMenuItem[] = [
    { label: "Cancel", onSelect: () => setPendingOverwriteIndex(null) },
    { label: "Overwrite", onSelect: handleConfirmOverwrite },
  ];

  return (
    <div
      className="modal-overlay"
      role="dialog"
      aria-modal="true"
      onClick={handleOverlayClose}
      onKeyDown={(e) => {
        if (e.defaultPrevented) {
          e.stopPropagation();
          return;
        }

        if (e.key === "Escape") {
          e.preventDefault();
          playConfirmFeedback();
          handleKeyboardBack();
        }
        e.stopPropagation();
      }}
    >
      <TerminalPanel
        className="stats-modal"
        style={{ maxWidth: "420px" }}
        onClick={(e) => e.stopPropagation()}
      >
        <p className="terminal-kicker">SAVE GAME</p>
        {pendingOverwriteIndex !== null && pendingOverwriteSave ? (
          <>
            <h2
              className="terminal-heading-md"
              style={{ marginBottom: "var(--space-4)" }}
            >
              Overwrite Slot?
            </h2>
            <p>{formatSlotSummary(pendingOverwriteSave, pendingOverwriteIndex)}</p>
            <p>This will replace the existing save in this slot.</p>
            <TerminalMenu
              ariaLabel="Overwrite save confirmation"
              items={overwriteMenuItems}
              onBack={handleKeyboardBack}
              onBackAction={playConfirmFeedback}
              {...menuFeedback}
            />
          </>
        ) : (
          <>
            <h2
              className="terminal-heading-md"
              style={{ marginBottom: "var(--space-4)" }}
            >
              Choose a Slot
            </h2>

            <TerminalMenu
              ariaLabel="Save slot choices"
              items={slotMenuItems}
              onBack={handleKeyboardBack}
              onBackAction={playConfirmFeedback}
              {...menuFeedback}
            />
          </>
        )}
      </TerminalPanel>
    </div>
  );
}
