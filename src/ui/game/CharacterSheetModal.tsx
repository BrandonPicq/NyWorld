import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import type {
  CoreAttributeKey,
  EquippedSlot,
  Inventory,
  KnownPatternMap,
  LayeredStatBreakdown,
  Stats,
} from "../../engine";
import { TerminalButton } from "../components/TerminalButton";
import { TerminalPanel } from "../components/TerminalPanel";
import type { AudioSettings } from "../audio/audioSettings";
import { playMenuConfirmSound, playMenuMoveSound } from "../audio/menuAudio";
import { OverviewTab } from "./sheet/OverviewTab";
import { AttributesTab } from "./sheet/AttributesTab";
import { EquipmentTab } from "./sheet/EquipmentTab";
import { MasteryTab } from "./sheet/MasteryTab";
import { AcademyTab } from "./sheet/AcademyTab";
import { getNextTabIndex, resolveTabKeyAction } from "../menu/tabNavigation";
import { consumeIfPointerOverKeyboardBlockingElement } from "../menu/pointerKeyboardBlock";

type CharacterSheetModalProps = {
  audioSettings: AudioSettings;
  onClose: () => void;
  onChooseAttribute: (attribute: CoreAttributeKey) => void;
  onUnequipSlot: (slot: EquippedSlot) => void;
  onEquipSlot: (itemId: string, slot: EquippedSlot) => void;
  onNavigateToItem: (itemId: string) => void;
  inventory: Inventory;
  knownPatterns: KnownPatternMap;
  stats: Stats;
  statLayers: LayeredStatBreakdown;
};

type CharacterTab = "overview" | "attributes" | "equipment" | "mastery" | "academy";

const TAB_LABELS: Record<CharacterTab, string> = {
  overview: "Overview",
  attributes: "Attributes",
  equipment: "Equipment",
  mastery: "Mastery",
  academy: "Academy",
};

const CHARACTER_TABS: CharacterTab[] = [
  "overview",
  "attributes",
  "equipment",
  "mastery",
  "academy",
];

export function CharacterSheetModal({
  audioSettings,
  inventory,
  knownPatterns,
  onChooseAttribute,
  onClose,
  onUnequipSlot,
  onEquipSlot,
  onNavigateToItem,
  stats,
  statLayers,
}: CharacterSheetModalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState<CharacterTab>("overview");

  useEffect(() => {
    containerRef.current?.focus();
  }, []);

  const handleClose = () => {
    if (audioSettings.soundEnabled) {
      playMenuConfirmSound();
    }
    onClose();
  };

  const handleTabSelect = (tab: CharacterTab) => {
    setActiveTab(tab);
    if (audioSettings.soundEnabled) {
      playMenuMoveSound();
    }
  };

  const handleKeyDown = useCallback((event: ReactKeyboardEvent<HTMLElement> | KeyboardEvent) => {
    if (
      event.target instanceof HTMLElement &&
      event.target.closest(".stats-modal--equip-picker")
    ) {
      return;
    }

    const action = resolveTabKeyAction(event.key, {
      tabCount: CHARACTER_TABS.length,
      hasCancel: true,
    });

    if (action.kind === "none") {
      return;
    }

    if (
      action.kind !== "cancel" &&
      consumeIfPointerOverKeyboardBlockingElement(event)
    ) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    if (action.kind === "cancel") {
      handleClose();
      return;
    }

    if (action.kind === "move") {
      const activeIndex = CHARACTER_TABS.indexOf(activeTab);
      handleTabSelect(
        CHARACTER_TABS[
          getNextTabIndex(activeIndex, CHARACTER_TABS.length, action.direction)
        ],
      );
      return;
    }

    handleTabSelect(CHARACTER_TABS[action.index]);
  }, [activeTab, audioSettings.soundEnabled, onClose]);

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  return (
    <div
      className="modal-overlay"
      onClick={handleClose}
      onKeyDown={handleKeyDown}
      ref={containerRef}
      style={{ outline: "none" }}
      tabIndex={-1}
    >
      <TerminalPanel
        className="stats-modal stats-modal--character"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="terminal-kicker">CHARACTER PROFILE</p>
        <h2 className="terminal-heading-md">Character Sheet</h2>

        <div className="stats-modal__tabs">
          {CHARACTER_TABS.map((tab) => (
              <TerminalButton
                key={tab}
                isSelected={activeTab === tab}
                onClick={() => handleTabSelect(tab)}
                tabIndex={activeTab === tab ? 0 : -1}
              >
                {TAB_LABELS[tab]}
              </TerminalButton>
            ))}
        </div>

        <div className="stats-modal__content">
          {activeTab === "overview" && <OverviewTab stats={stats} />}
          {activeTab === "attributes" && (
            <AttributesTab
              statLayers={statLayers}
              onChooseAttribute={onChooseAttribute}
            />
          )}
          {activeTab === "equipment" && (
            <EquipmentTab
              audioSettings={audioSettings}
              inventory={inventory}
              classId={statLayers.classId}
              onUnequipSlot={onUnequipSlot}
              onEquipSlot={onEquipSlot}
              onNavigateToItem={onNavigateToItem}
            />
          )}
          {activeTab === "mastery" && (
            <MasteryTab
              knownPatterns={knownPatterns}
              stats={stats}
              statLayers={statLayers}
            />
          )}
          {activeTab === "academy" && <AcademyTab stats={stats} />}
        </div>

        <div className="stats-modal__actions">
          <TerminalButton onClick={handleClose}>Close [Esc]</TerminalButton>
        </div>
      </TerminalPanel>
    </div>
  );
}
