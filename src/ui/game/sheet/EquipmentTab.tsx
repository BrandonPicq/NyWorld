import { useState } from "react";
import type { EquippedSlot, Inventory } from "../../../engine";
import { getItemDef } from "../../../engine/items/itemRegistry";
import type { AudioSettings } from "../../audio/audioSettings";
import { EquipPickerModal } from "./EquipPickerModal";

type EquipmentTabProps = {
  audioSettings: AudioSettings;
  inventory: Inventory;
  classId: string;
  onUnequipSlot: (slot: EquippedSlot) => void;
  onEquipSlot: (itemId: string, slot: EquippedSlot) => void;
  onNavigateToItem: (itemId: string) => void;
};

const SLOTS_CONFIG: { slot: EquippedSlot; gridArea: string; label: string }[] = [
  { slot: "head", gridArea: "head", label: "Head" },
  { slot: "body", gridArea: "body", label: "Body" },
  { slot: "hands", gridArea: "hands", label: "Hands" },
  { slot: "feet", gridArea: "feet", label: "Feet" },
  { slot: "weapon", gridArea: "weapon", label: "Weapon" },
  { slot: "offHand", gridArea: "offHand", label: "Off-Hand" },
  { slot: "accessory1", gridArea: "accessory1", label: "Accessory 1" },
  { slot: "accessory2", gridArea: "accessory2", label: "Accessory 2" },
];

export function EquipmentTab({
  audioSettings,
  inventory,
  classId,
  onUnequipSlot,
  onEquipSlot,
  onNavigateToItem,
}: EquipmentTabProps) {
  const [activePickerSlot, setActivePickerSlot] = useState<EquippedSlot | null>(null);

  return (
    <div className="stats-modal__tab-content">
      <div className="stats-modal__section stats-modal__section--equipment">
        <h3 className="stats-modal__subtitle">Equipment</h3>
        <div className="equipment-body-layout">
          {SLOTS_CONFIG.map(({ slot, gridArea, label }) => {
            const itemId = inventory.equipped[slot];
            const itemName = itemId ? getItemDef(itemId).name : "Empty";

            return (
              <div
                key={slot}
                className="equipment-slot-zone"
                style={{ gridArea }}
                onClick={() => setActivePickerSlot(slot)}
              >
                <div className="equipment-slot-zone__header">
                  <span className="equipment-slot-zone__label">{label}</span>
                  {itemId ? (
                    <button
                      className="equipment-slot-zone__marker"
                      onClick={(e) => {
                        e.stopPropagation();
                        onNavigateToItem(itemId);
                      }}
                      title="Inspect in inventory"
                    >
                      [✓]
                    </button>
                  ) : (
                    <span className="equipment-slot-zone__marker" style={{ opacity: 0.3 }}>
                      [ ]
                    </span>
                  )}
                </div>
                <div className="equipment-slot-zone__name">{itemName}</div>
              </div>
            );
          })}
        </div>
      </div>

      {activePickerSlot && (
        <EquipPickerModal
          audioSettings={audioSettings}
          slot={activePickerSlot}
          classId={classId}
          inventory={inventory}
          currentlyEquippedItemId={inventory.equipped[activePickerSlot]}
          onClose={() => setActivePickerSlot(null)}
          onEquip={(itemId) => onEquipSlot(itemId, activePickerSlot)}
          onUnequip={() => onUnequipSlot(activePickerSlot)}
        />
      )}
    </div>
  );
}
