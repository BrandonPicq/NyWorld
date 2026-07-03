import { useEffect, useRef } from "react";
import type { InventoryStack } from "../../engine/components";
import { getItemDef } from "../../engine";
import type { AudioSettings } from "../audio/audioSettings";
import { playMenuMoveSound } from "../audio/menuAudio";
import { TerminalButton } from "../components/TerminalButton";
import { TerminalPanel } from "../components/TerminalPanel";
import { useMenuKeyboard } from "../hooks/useMenuKeyboard";

type CombatItemPickerModalProps = {
  audioSettings: AudioSettings;
  items: InventoryStack[];
  onClose: () => void;
  onUseItem: (itemId: string) => void;
};

export function CombatItemPickerModal({
  audioSettings,
  items,
  onClose,
  onUseItem,
}: CombatItemPickerModalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const hasItems = items.length > 0;

  useEffect(() => {
    containerRef.current?.focus();
  }, []);

  const handleUseSelected = (index: number) => {
    const selectedItem = items[index];
    if (!selectedItem) return;
    onUseItem(selectedItem.itemId);
  };

  const { selectedIndex, setSelectedIndex, handleKeyDown } = useMenuKeyboard({
    itemCount: items.length,
    audioSettings,
    enableDirectionalLetterKeys: false,
    onConfirm: handleUseSelected,
    onCancel: onClose,
  });

  return (
    <div
      className="modal-overlay"
      onClick={onClose}
      onKeyDown={(event) => {
        event.stopPropagation();
        handleKeyDown(event);
      }}
      ref={containerRef}
      role="dialog"
      aria-modal="true"
      aria-label="Combat item selection"
      tabIndex={-1}
      style={{ outline: "none" }}
    >
      <TerminalPanel
        className="stats-modal stats-modal--combat-items"
        onClick={(event) => event.stopPropagation()}
      >
        <p className="terminal-kicker">COMBAT ITEM</p>
        <h2 className="terminal-heading-md">Use Item</h2>

        <div className="combat-item-modal__content">
          {!hasItems ? (
            <p className="stats-modal__empty">No usable combat items.</p>
          ) : (
            items.map((stack, index) => {
              const itemDef = getItemDef(stack.itemId);
              const isSelected = index === selectedIndex;

              return (
                <button
                  className={`combat-item-modal__row ${
                    isSelected ? "combat-item-modal__row--selected" : ""
                  }`}
                  key={stack.itemId}
                  onClick={() => handleUseSelected(index)}
                  onMouseEnter={() => {
                    if (index !== selectedIndex) {
                      setSelectedIndex(index);
                      if (audioSettings.soundEnabled) {
                        playMenuMoveSound();
                      }
                    }
                  }}
                  type="button"
                >
                  <span className="combat-item-modal__main">
                    <span className="combat-item-modal__name">
                      {isSelected ? "> " : ""}
                      {itemDef.name}
                    </span>
                    <span className="combat-item-modal__description">
                      {itemDef.description}
                    </span>
                  </span>
                  <span className="combat-item-modal__quantity">
                    x{stack.quantity}
                  </span>
                </button>
              );
            })
          )}
        </div>

        <div className="stats-modal__actions">
          <TerminalButton onClick={onClose}>Close [Esc]</TerminalButton>
        </div>
      </TerminalPanel>
    </div>
  );
}
