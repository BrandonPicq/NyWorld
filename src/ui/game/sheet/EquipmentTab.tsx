import {
  EQUIPPED_SLOT_IDS,
  type EquippedSlot,
  type Inventory,
} from "../../../engine";
import { getItemDef } from "../../../engine/items/itemRegistry";
import { TerminalButton } from "../../components/TerminalButton";

type EquipmentTabProps = {
  inventory: Inventory;
  onUnequipSlot: (slot: EquippedSlot) => void;
};

export function EquipmentTab({ inventory, onUnequipSlot }: EquipmentTabProps) {
  return (
    <div className="stats-modal__tab-content">
      <div className="stats-modal__section stats-modal__section--equipment">
        <h3 className="stats-modal__subtitle">Equipment</h3>
        <div className="stats-modal__equipment-grid">
          {EQUIPPED_SLOT_IDS.map((slot) => {
            const itemId = inventory.equipped[slot];
            const itemName = itemId ? getItemDef(itemId).name : "Empty";
            return (
              <div className="stats-modal__equipment-row" key={slot}>
                <span className="stats-modal__attr-name">
                  {formatSlotLabel(slot)}
                </span>
                <span className="stats-modal__equipment-name">{itemName}</span>
                {itemId && (
                  <TerminalButton
                    className="stats-modal__equipment-action"
                    onClick={() => onUnequipSlot(slot)}
                  >
                    Unequip
                  </TerminalButton>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function formatSlotLabel(slot: EquippedSlot): string {
  return slot
    .replace(/([A-Z0-9])/g, " $1")
    .replace(/^./, (firstLetter) => firstLetter.toUpperCase());
}
