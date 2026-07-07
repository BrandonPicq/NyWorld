import { useEffect, useRef } from "react";
import { getItemDef } from "../../../engine/items/itemRegistry";
import { TerminalButton } from "../../components/TerminalButton";
import { TerminalPanel } from "../../components/TerminalPanel";
import type { AudioSettings } from "../../audio/audioSettings";
import { useMenuKeyboard } from "../../hooks/useMenuKeyboard";
import { playMenuMoveSound, playMenuConfirmSound } from "../../audio/menuAudio";
import { getEquippableItemsForSlot } from "./equipmentHelper";
import type { Inventory, EquippedSlot } from "../../../engine";

type EquipPickerModalProps = {
  audioSettings: AudioSettings;
  slot: EquippedSlot;
  classId: string;
  inventory: Inventory;
  onClose: () => void;
  onEquip: (itemId: string) => void;
  onUnequip: () => void;
  currentlyEquippedItemId?: string;
};

export function EquipPickerModal({
  audioSettings,
  slot,
  classId,
  inventory,
  onClose,
  onEquip,
  onUnequip,
  currentlyEquippedItemId,
}: EquipPickerModalProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const equippableItems = getEquippableItemsForSlot(inventory.items, slot, classId);

  // Auto-focus container on mount to catch keys
  useEffect(() => {
    containerRef.current?.focus();
  }, []);

  const formatSlotLabel = (s: EquippedSlot): string => {
    return s
      .replace(/([A-Z0-9])/g, " $1")
      .replace(/^./, (firstLetter) => firstLetter.toUpperCase());
  };

  // Build selectable items list
  type Option =
    | { type: "unequip" }
    | { type: "equip"; itemId: string; name: string };

  const options: Option[] = [];
  if (currentlyEquippedItemId) {
    options.push({ type: "unequip" });
  }

  for (const stack of equippableItems) {
    // Avoid listing the currently equipped item as a candidate
    if (stack.itemId !== currentlyEquippedItemId) {
      options.push({
        type: "equip",
        itemId: stack.itemId,
        name: getItemDef(stack.itemId).name,
      });
    }
  }

  const hasOptions = options.length > 0;

  const handleSelectOption = (index: number) => {
    if (!hasOptions) return;
    const option = options[index];
    if (option.type === "unequip") {
      onUnequip();
    } else if (option.type === "equip") {
      onEquip(option.itemId);
    }
    onClose();
  };

  const { selectedIndex, setSelectedIndex, handleKeyDown } = useMenuKeyboard({
    itemCount: options.length,
    audioSettings,
    onConfirm: (index) => handleSelectOption(index),
    onCancel: onClose,
  });

  return (
    <div
      className="modal-overlay"
      onClick={onClose}
      onKeyDown={handleKeyDown}
      tabIndex={-1}
      ref={containerRef}
      style={{ outline: "none" }}
    >
      <TerminalPanel
        className="stats-modal stats-modal--equip-picker"
        onClick={(e: React.MouseEvent) => e.stopPropagation()}
      >
        <p className="terminal-kicker">EQUIPMENT PICKER</p>
        <h2 className="terminal-heading-md">Equip {formatSlotLabel(slot)}</h2>

        <div className="stats-modal__content">
          <div className="stats-modal__inventory-left" style={{ borderRight: "none", flex: "1 1 100%", maxHeight: "240px" }}>
            {!hasOptions ? (
              <p className="stats-modal__empty">No equippable items in inventory.</p>
            ) : (
              options.map((opt, index) => {
                const isSelected = index === selectedIndex;
                return (
                  <div
                    key={opt.type === "unequip" ? "unequip-opt" : opt.itemId}
                    className={`stats-modal__inventory-row ${
                      isSelected ? "stats-modal__inventory-row--selected" : ""
                    }`}
                    onClick={() => {
                      setSelectedIndex(index);
                      if (audioSettings.soundEnabled && index !== selectedIndex) {
                        playMenuMoveSound();
                      }
                    }}
                  >
                    <span className="stats-modal__inventory-name">
                      {isSelected ? "> " : "  "}{" "}
                      {opt.type === "unequip" ? "[Unequip Current Item]" : opt.name}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="stats-modal__actions">
          {hasOptions && (
            <TerminalButton
              onClick={() => handleSelectOption(selectedIndex)}
              style={{ marginRight: "var(--space-2)" }}
            >
              Select
            </TerminalButton>
          )}
          <TerminalButton onClick={onClose}>Cancel [Esc]</TerminalButton>
        </div>
      </TerminalPanel>
    </div>
  );
}
