import { useState } from "react";
import type {
  CoreAttributeKey,
  EquippedSlot,
  Inventory,
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

type CharacterSheetModalProps = {
  audioSettings: AudioSettings;
  onClose: () => void;
  onChooseAttribute: (attribute: CoreAttributeKey) => void;
  onUnequipSlot: (slot: EquippedSlot) => void;
  inventory: Inventory;
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

export function CharacterSheetModal({
  audioSettings,
  inventory,
  onChooseAttribute,
  onClose,
  onUnequipSlot,
  stats,
  statLayers,
}: CharacterSheetModalProps) {
  const [activeTab, setActiveTab] = useState<CharacterTab>("overview");

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

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <TerminalPanel
        className="stats-modal stats-modal--character"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="terminal-kicker">CHARACTER PROFILE</p>
        <h2 className="terminal-heading-md">Character Sheet</h2>

        <div className="stats-modal__tabs">
          {(["overview", "attributes", "equipment", "mastery", "academy"] as CharacterTab[]).map(
            (tab) => (
              <TerminalButton
                key={tab}
                isSelected={activeTab === tab}
                onClick={() => handleTabSelect(tab)}
              >
                {TAB_LABELS[tab]}
              </TerminalButton>
            )
          )}
        </div>

        <div className="stats-modal__content">
          {activeTab === "overview" && <OverviewTab stats={stats} />}
          {activeTab === "attributes" && (
            <AttributesTab
              stats={stats}
              statLayers={statLayers}
              onChooseAttribute={onChooseAttribute}
            />
          )}
          {activeTab === "equipment" && (
            <EquipmentTab inventory={inventory} onUnequipSlot={onUnequipSlot} />
          )}
          {activeTab === "mastery" && <MasteryTab stats={stats} statLayers={statLayers} />}
          {activeTab === "academy" && <AcademyTab stats={stats} />}
        </div>

        <div className="stats-modal__actions">
          <TerminalButton onClick={handleClose}>Close [Esc]</TerminalButton>
        </div>
      </TerminalPanel>
    </div>
  );
}
