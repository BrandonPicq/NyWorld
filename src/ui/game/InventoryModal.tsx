import type { Inventory, InventoryItemCategory } from "../../engine/components";
import { getItemDef } from "../../engine/items/itemRegistry";
import { TerminalButton } from "../components/TerminalButton";
import { TerminalPanel } from "../components/TerminalPanel";
import type { AudioSettings } from "../audio/audioSettings";
import { playMenuConfirmSound } from "../audio/menuAudio";

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

export function InventoryModal({
  audioSettings,
  inventory,
  onClose,
  onUseItem,
}: InventoryModalProps) {
  const handleClose = () => {
    if (audioSettings.soundEnabled) {
      playMenuConfirmSound();
    }
    onClose();
  };

  return (
    <div
      className="modal-overlay"
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
        onClick={(e) => e.stopPropagation()}
      >
        <p className="terminal-kicker">POSSESSIONS</p>
        <h2 className="terminal-heading-md">Inventory</h2>

        <div className="stats-modal__content">
          {inventory.items.length === 0 ? (
            <p className="stats-modal__empty">No items carried.</p>
          ) : (
            <div className="stats-modal__inventory-list">
              {inventory.items.map((stack) => {
                const def = getItemDef(stack.itemId);
                return (
                  <div
                    key={stack.itemId}
                    className="stats-modal__inventory-item"
                  >
                    <div className="stats-modal__inventory-header">
                      <span className="stats-modal__inventory-name">
                        {def.name}
                      </span>
                      <span className="stats-modal__inventory-quantity">
                        x{stack.quantity}
                      </span>
                    </div>
                    <span className="stats-modal__inventory-category">
                      {CATEGORY_LABELS[def.category] ?? def.category}
                    </span>
                    <p className="stats-modal__inventory-description">
                      {def.description}
                    </p>
                    {def.category === "consumable" && (
                      <TerminalButton
                        className="stats-modal__inventory-use"
                        onClick={() => onUseItem(stack.itemId)}
                      >
                        [Use]
                      </TerminalButton>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="stats-modal__actions">
          <TerminalButton onClick={handleClose}>Close [Esc]</TerminalButton>
        </div>
      </TerminalPanel>
    </div>
  );
}
