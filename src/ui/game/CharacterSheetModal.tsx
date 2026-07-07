import {
  EQUIPPED_SLOT_IDS,
  type CoreAttributeKey,
  type EquippedSlot,
  type Inventory,
  type LayeredStatBreakdown,
  type Stats,
} from "../../engine";
import { getItemDef } from "../../engine/items/itemRegistry";
import { TerminalButton } from "../components/TerminalButton";
import { TerminalPanel } from "../components/TerminalPanel";
import type { AudioSettings } from "../audio/audioSettings";
import { playMenuConfirmSound } from "../audio/menuAudio";

type CharacterSheetModalProps = {
  audioSettings: AudioSettings;
  onClose: () => void;
  onChooseAttribute: (attribute: CoreAttributeKey) => void;
  onUnequipSlot: (slot: EquippedSlot) => void;
  inventory: Inventory;
  stats: Stats;
  statLayers: LayeredStatBreakdown;
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
  const handleClose = () => {
    if (audioSettings.soundEnabled) {
      playMenuConfirmSound();
    }
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <TerminalPanel
        className="stats-modal stats-modal--character"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="terminal-kicker">CHARACTER PROFILE</p>
        <h2 className="terminal-heading-md">Character Sheet</h2>

        <div className="stats-modal__content stats-modal__content--character">
          <div className="stats-modal__section stats-modal__section--resources">
            <h3 className="stats-modal__subtitle">Resources</h3>
            <div className="stats-modal__grid">
              <StatsRow
                label="HP"
                value={`${stats.resources.hp} / ${stats.resources.maxHp}`}
              />
              <StatsRow
                label="MP"
                value={`${stats.resources.mp} / ${stats.resources.maxMp}`}
              />
              <StatsRow
                label="SP"
                value={`${stats.resources.sp} / ${stats.resources.maxSp}`}
              />
              <StatsRow
                label="Energy"
                value={`${stats.resources.energy} / ${stats.resources.maxEnergy}`}
              />
            </div>
          </div>

          <div className="stats-modal__section stats-modal__section--attributes">
            <h3 className="stats-modal__subtitle">Attributes</h3>
            <div className="stats-modal__grid">
              {Object.entries(stats.attributes).map(([key, val]) => (
                <StatsRow key={key} label={formatStatLabel(key)} value={val} />
              ))}
            </div>
          </div>

          <div className="stats-modal__section stats-modal__section--layers">
            <h3 className="stats-modal__subtitle">Growth Layers</h3>
            <div className="stats-modal__academic">
              <p>
                <strong>Class:</strong> {statLayers.classId} Lv.{" "}
                {statLayers.classLevel}
              </p>
              <p>
                <strong>Race:</strong> {statLayers.raceId}
              </p>
              <p>
                <strong>Global Level:</strong> {statLayers.globalLevel}
              </p>
              <p>
                <strong>Global XP:</strong> {statLayers.globalXp} /{" "}
                {statLayers.globalXpToNext}
              </p>
              <p>
                <strong>Class XP:</strong> {statLayers.classXp} /{" "}
                {statLayers.classXpToNext}
              </p>
              <p>
                <strong>Attribute Choices:</strong>{" "}
                {statLayers.pendingAttributeChoices}
              </p>
            </div>
            {statLayers.pendingAttributeChoices > 0 && (
              <div className="stats-modal__choice-grid">
                {Object.keys(stats.attributes).map((attribute) => (
                  <TerminalButton
                    className="stats-modal__choice-action"
                    key={attribute}
                    onClick={() => onChooseAttribute(attribute as CoreAttributeKey)}
                  >
                    + {formatStatLabel(attribute)}
                  </TerminalButton>
                ))}
              </div>
            )}
            <div className="stats-modal__layer-grid">
              <span>Attribute</span>
              <span>Base</span>
              <span>Global</span>
              <span>Class</span>
              <span>Equip</span>
              {Object.entries(statLayers.effectiveAttributes).map(([key]) => (
                <StatsLayerRow
                  classValue={statLayers.classAttributes[key as keyof typeof statLayers.classAttributes]}
                  equipmentValue={statLayers.equipmentAttributes[key as keyof typeof statLayers.equipmentAttributes]}
                  globalValue={statLayers.globalAttributes[key as keyof typeof statLayers.globalAttributes]}
                  key={key}
                  label={formatStatLabel(key)}
                  baseValue={statLayers.baseAttributes[key as keyof typeof statLayers.baseAttributes]}
                />
              ))}
            </div>
          </div>

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
                    <span className="stats-modal__equipment-name">
                      {itemName}
                    </span>
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

          <div className="stats-modal__section stats-modal__section--combat">
            <h3 className="stats-modal__subtitle">Combat</h3>
            <div className="stats-modal__grid">
              {Object.entries(stats.combat).map(([key, val]) => (
                <StatsRow key={key} label={formatStatLabel(key)} value={val} />
              ))}
            </div>
          </div>

          <div className="stats-modal__section stats-modal__section--skills">
            <h3 className="stats-modal__subtitle">Skills</h3>
            <div className="stats-modal__grid">
              {Object.entries(stats.skills).map(([key, val]) => (
                <StatsRow key={key} label={formatStatLabel(key)} value={val} />
              ))}
            </div>
          </div>

          <div className="stats-modal__section stats-modal__section--academy">
            <h3 className="stats-modal__subtitle">Academy Status</h3>
            <div className="stats-modal__academic">
              <p>
                <strong>Title:</strong> {stats.progression.academicTitle}
              </p>
              <p>
                <strong>Studies Progress:</strong>{" "}
                {stats.progression.academicProgress}%
              </p>
              <p>
                <strong>Conditions:</strong>{" "}
                {stats.conditions.length > 0
                  ? stats.conditions.map((c) => c.name).join(", ")
                  : "None"}
              </p>
            </div>
          </div>
        </div>

        <div className="stats-modal__actions">
          <TerminalButton onClick={handleClose}>Close [Esc]</TerminalButton>
        </div>
      </TerminalPanel>
    </div>
  );
}

function StatsLayerRow({
  label,
  baseValue,
  globalValue,
  classValue,
  equipmentValue,
}: {
  label: string;
  baseValue: number;
  globalValue: number;
  classValue: number;
  equipmentValue: number;
}) {
  return (
    <>
      <span className="stats-modal__attr-name">{label}</span>
      <span className="stats-modal__attr-value">{baseValue}</span>
      <span className="stats-modal__attr-value">
        {formatSigned(globalValue)}
      </span>
      <span className="stats-modal__attr-value">{formatSigned(classValue)}</span>
      <span className="stats-modal__attr-value">
        {formatSigned(equipmentValue)}
      </span>
    </>
  );
}

function formatSigned(value: number): string {
  return value > 0 ? `+${value}` : String(value);
}

function formatSlotLabel(slot: EquippedSlot): string {
  return slot
    .replace(/([A-Z0-9])/g, " $1")
    .replace(/^./, (firstLetter) => firstLetter.toUpperCase());
}

function StatsRow({
  label,
  value,
}: {
  label: string;
  value: number | string;
}) {
  return (
    <div className="stats-modal__row">
      <span className="stats-modal__attr-name">{label}</span>
      <span className="stats-modal__attr-value">{value}</span>
    </div>
  );
}

function formatStatLabel(key: string): string {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (firstLetter) => firstLetter.toUpperCase());
}
