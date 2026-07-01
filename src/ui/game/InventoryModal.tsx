import { useEffect, useRef } from "react";
import type { Inventory, InventoryItemCategory } from "../../engine/components";
import { getItemDef } from "../../engine/items/itemRegistry";
import { TerminalButton } from "../components/TerminalButton";
import { TerminalPanel } from "../components/TerminalPanel";
import type { AudioSettings } from "../audio/audioSettings";
import { useMenuKeyboard } from "../hooks/useMenuKeyboard";
import { playMenuMoveSound } from "../audio/menuAudio";

type InventoryModalProps = {
  audioSettings: AudioSettings;
  inventory: Inventory;
  onClose: () => void;
  onUseItem: (itemId: string) => void;
};

const CATEGORY_LABELS: Record<InventoryItemCategory, string> = {
  quest: "Quest",
  consumable: "Consumable",
  material: "Material",
  misc: "Misc",
};

const CATEGORY_COLORS: Record<InventoryItemCategory, string> = {
  quest: "#cba6f7",
  consumable: "#a6e3a1",
  material: "#cdd6f4",
  misc: "#f9e2af",
};

export function InventoryModal({
  audioSettings,
  inventory,
  onClose,
  onUseItem,
}: InventoryModalProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const items = inventory.items;
  const hasItems = items.length > 0;

  // Auto-focus container on mount to catch keys
  useEffect(() => {
    containerRef.current?.focus();
  }, []);

  const handleClose = () => {
    onClose();
  };

  const handleUseSelected = (index: number) => {
    if (!hasItems) return;
    const selectedItem = items[index];
    if (!selectedItem) return;
    const def = getItemDef(selectedItem.itemId);
    if (def.category === "consumable") {
      onUseItem(selectedItem.itemId);
    }
  };

  const { selectedIndex, setSelectedIndex, handleKeyDown } = useMenuKeyboard({
    itemCount: items.length,
    audioSettings,
    onConfirm: (index) => handleUseSelected(index),
    onCancel: handleClose,
    extraKeys: {
      u: (index) => handleUseSelected(index),
    },
  });

  const selectedItem = hasItems ? items[selectedIndex] : null;
  const selectedDef = selectedItem ? getItemDef(selectedItem.itemId) : null;

  return (
    <div
      className="modal-overlay"
      onClick={handleClose}
      onKeyDown={handleKeyDown}
      tabIndex={-1}
      ref={containerRef}
      style={{ outline: "none" }}
    >
      <TerminalPanel
        className="stats-modal stats-modal--inventory"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="terminal-kicker">POSSESSIONS</p>
        <h2 className="terminal-heading-md">Inventory</h2>

        <div className="stats-modal__content stats-modal__content--inventory">
          {/* Left Pane: List */}
          <div className="stats-modal__inventory-left">
            {!hasItems ? (
              <p className="stats-modal__empty">No items carried.</p>
            ) : (
              items.map((stack, index) => {
                const def = getItemDef(stack.itemId);
                const isSelected = index === selectedIndex;
                return (
                  <div
                    key={stack.itemId}
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
                      {isSelected ? "> " : "  "} {def.name}
                    </span>
                    <span className="stats-modal__inventory-qty">
                      x{stack.quantity}
                    </span>
                  </div>
                );
              })
            )}
          </div>

          {/* Right Pane: Details */}
          <div className="stats-modal__inventory-right">
            {selectedItem && selectedDef ? (
              <div className="stats-modal__inventory-detail">
                <div className="stats-modal__inventory-detail-header">
                  <h3 className="stats-modal__inventory-detail-title">
                    {selectedDef.name}
                  </h3>
                  <span
                    className="stats-modal__inventory-detail-cat"
                    style={{ color: CATEGORY_COLORS[selectedDef.category] }}
                  >
                    {CATEGORY_LABELS[selectedDef.category] ?? selectedDef.category}
                  </span>
                </div>
                <p className="stats-modal__inventory-detail-desc">
                  {selectedDef.description}
                </p>

                {selectedDef.category === "consumable" && (
                  <TerminalButton
                    className="stats-modal__inventory-detail-action"
                    onClick={() => handleUseSelected(selectedIndex)}
                  >
                    [Use Item]
                  </TerminalButton>
                )}
              </div>
            ) : (
              <p className="stats-modal__empty">Select an item to view details.</p>
            )}
          </div>
        </div>

        <div className="stats-modal__actions">
          <TerminalButton onClick={handleClose}>Close [Esc]</TerminalButton>
        </div>
      </TerminalPanel>
    </div>
  );
}
