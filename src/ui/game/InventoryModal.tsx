import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import type { Inventory, InventoryItemCategory } from "../../engine/components";
import { getItemDef } from "../../engine/items/itemRegistry";
import { TerminalButton } from "../components/TerminalButton";
import { TerminalPanel } from "../components/TerminalPanel";
import type { AudioSettings } from "../audio/audioSettings";
import { useMenuKeyboard } from "../hooks/useMenuKeyboard";
import { playMenuMoveSound } from "../audio/menuAudio";
import { getCategoriesPresent } from "./inventoryHelper";
import { getNextTabIndex, resolveTabKeyAction } from "../menu/tabNavigation";
import { consumeIfPointerOverKeyboardBlockingElement } from "../menu/pointerKeyboardBlock";

type InventoryModalProps = {
  audioSettings: AudioSettings;
  inventory: Inventory;
  onClose: () => void;
  onEquipItem: (itemId: string) => void;
  onUseItem: (itemId: string) => void;
  initialSelectedItemId?: string;
};

const CATEGORY_LABELS: Record<InventoryItemCategory, string> = {
  quest: "Quest",
  consumable: "Consumable",
  material: "Material",
  equipment: "Equipment",
  misc: "Misc",
};

const CATEGORY_COLORS: Record<InventoryItemCategory, string> = {
  quest: "#cba6f7",
  consumable: "#a6e3a1",
  material: "#cdd6f4",
  equipment: "#89b4fa",
  misc: "#f9e2af",
};

export function InventoryModal({
  audioSettings,
  inventory,
  onClose,
  onEquipItem,
  onUseItem,
  initialSelectedItemId,
}: InventoryModalProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const items = inventory.items;

  // Determine initial active tab: either the category of the initialSelectedItemId, or "all"
  const initialTab = initialSelectedItemId
    ? getItemDef(initialSelectedItemId).category
    : "all";

  const [activeTab, setActiveTab] = useState<"all" | InventoryItemCategory>(initialTab);

  // Auto-focus container on mount to catch keys
  useEffect(() => {
    containerRef.current?.focus();
  }, []);

  const handleClose = () => {
    onClose();
  };

  const presentCategories = getCategoriesPresent(items, (id) => getItemDef(id).category);
  const inventoryTabs: Array<"all" | InventoryItemCategory> = [
    "all",
    ...presentCategories,
  ];

  // Filter items based on active tab
  const filteredItems = activeTab === "all"
    ? items
    : items.filter((item) => getItemDef(item.itemId).category === activeTab);

  const hasItems = filteredItems.length > 0;

  // Find index of pre-selected item if it exists in current filtered list
  const targetIndex = initialSelectedItemId
    ? filteredItems.findIndex((stack) => stack.itemId === initialSelectedItemId)
    : -1;
  const initialIndex = targetIndex >= 0 ? targetIndex : 0;

  const handleUseSelected = (index: number) => {
    if (!hasItems) return;
    const selectedItem = filteredItems[index];
    if (!selectedItem) return;
    const def = getItemDef(selectedItem.itemId);
    if (def.category === "consumable") {
      onUseItem(selectedItem.itemId);
    }
  };

  const handleEquipSelected = (index: number) => {
    if (!hasItems) return;
    const selectedItem = filteredItems[index];
    if (!selectedItem) return;
    const def = getItemDef(selectedItem.itemId);
    if (def.category === "equipment" && def.equipment) {
      onEquipItem(selectedItem.itemId);
    }
  };

  const { selectedIndex, setSelectedIndex, handleKeyDown } = useMenuKeyboard({
    itemCount: filteredItems.length,
    audioSettings,
    initialIndex,
    onConfirm: (index) => handleUseSelected(index),
    onCancel: handleClose,
    extraKeys: {
      e: (index) => handleEquipSelected(index),
      u: (index) => handleUseSelected(index),
    },
  });

  const selectedItem = hasItems ? filteredItems[selectedIndex] : null;
  const selectedDef = selectedItem ? getItemDef(selectedItem.itemId) : null;
  const equippedItemIds = new Set(Object.values(inventory.equipped));

  const handleInventoryKeyDown = (
    event: KeyboardEvent<HTMLElement>,
  ) => {
    const tabAction = resolveTabKeyAction(event.key, {
      tabCount: inventoryTabs.length,
    });

    if (tabAction.kind === "move") {
      if (consumeIfPointerOverKeyboardBlockingElement(event)) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      const activeIndex = Math.max(0, inventoryTabs.indexOf(activeTab));
      const nextIndex = getNextTabIndex(
        activeIndex,
        inventoryTabs.length,
        tabAction.direction,
      );
      setActiveTab(inventoryTabs[nextIndex]);
      setSelectedIndex(0);
      if (audioSettings.soundEnabled) {
        playMenuMoveSound();
      }
      return;
    }

    handleKeyDown(event);
  };

  return (
    <div
      className="modal-overlay"
      onClick={handleClose}
      onKeyDown={handleInventoryKeyDown}
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

        <div className="stats-modal__tabs">
          <TerminalButton
            isSelected={activeTab === "all"}
            tabIndex={activeTab === "all" ? 0 : -1}
            onClick={() => {
              setActiveTab("all");
              setSelectedIndex(0);
              if (audioSettings.soundEnabled) {
                playMenuMoveSound();
              }
            }}
          >
            All
          </TerminalButton>
          {presentCategories.map((cat) => (
            <TerminalButton
              key={cat}
              isSelected={activeTab === cat}
              tabIndex={activeTab === cat ? 0 : -1}
              onClick={() => {
                setActiveTab(cat);
                setSelectedIndex(0);
                if (audioSettings.soundEnabled) {
                  playMenuMoveSound();
                }
              }}
            >
              {CATEGORY_LABELS[cat] ?? cat}
            </TerminalButton>
          ))}
        </div>

        <div className="stats-modal__content stats-modal__content--inventory">
          {/* Left Pane: List */}
          <div className="stats-modal__inventory-left">
            {!hasItems ? (
              <p className="stats-modal__empty">No items in this category.</p>
            ) : (
              filteredItems.map((stack, index) => {
                const def = getItemDef(stack.itemId);
                const isSelected = index === selectedIndex;
                return (
                  <div
                    key={stack.itemId}
                    className={`stats-modal__inventory-row ${
                      isSelected ? "stats-modal__inventory-row--selected" : ""
                    }`}
                    data-keyboard-blocking-hover="true"
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
                      {equippedItemIds.has(stack.itemId)
                        ? `Equipped x${stack.quantity}`
                        : `x${stack.quantity}`}
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

                {selectedDef.category === "equipment" && selectedDef.equipment && (
                  <TerminalButton
                    className="stats-modal__inventory-detail-action"
                    onClick={() => handleEquipSelected(selectedIndex)}
                  >
                    {equippedItemIds.has(selectedItem.itemId) ? "[Unequip]" : "[Equip]"}
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
