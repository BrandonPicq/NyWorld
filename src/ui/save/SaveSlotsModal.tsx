import { useState } from "react";
import { formatWorldDateTime } from "../../engine";
import type { GameSaveData } from "../../engine/GameSaveData";
import { TerminalPanel } from "../components/TerminalPanel";
import { TerminalButton } from "../components/TerminalButton";
import { SAVE_SLOT_COUNT } from "./gameSaveStorage";

type SaveSlotsModalProps = {
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
  onClose,
  onSave,
  slots,
}: SaveSlotsModalProps) {
  const [pendingOverwriteIndex, setPendingOverwriteIndex] = useState<
    number | null
  >(null);
  const handleClose = () => onClose();
  const pendingOverwriteSave =
    pendingOverwriteIndex !== null ? slots[pendingOverwriteIndex] : null;

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

  return (
    <div
      className="modal-overlay"
      role="dialog"
      aria-modal="true"
      onClick={handleClose}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          handleClose();
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
            <div
              className="stats-modal__actions"
              style={{ marginTop: "var(--space-4)" }}
            >
              <TerminalButton onClick={() => setPendingOverwriteIndex(null)}>
                [Cancel]
              </TerminalButton>
              <TerminalButton onClick={handleConfirmOverwrite}>
                [Overwrite]
              </TerminalButton>
            </div>
          </>
        ) : (
          <>
            <h2
              className="terminal-heading-md"
              style={{ marginBottom: "var(--space-4)" }}
            >
              Choose a Slot
            </h2>

            <div className="terminal-menu" role="listbox">
              {Array.from({ length: SAVE_SLOT_COUNT }, (_, i) => (
                <TerminalButton
                  key={i}
                  onClick={() => handleSelectSlot(i)}
                  style={{ textAlign: "left" }}
                >
                  {formatSlotSummary(slots[i], i)}
                </TerminalButton>
              ))}
            </div>

            <div
              className="stats-modal__actions"
              style={{ marginTop: "var(--space-4)" }}
            >
              <TerminalButton onClick={handleClose}>
                [Cancel]
              </TerminalButton>
            </div>
          </>
        )}
      </TerminalPanel>
    </div>
  );
}
