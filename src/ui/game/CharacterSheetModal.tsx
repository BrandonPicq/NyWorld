import type { Stats } from "../../engine/components";
import { TerminalButton } from "../components/TerminalButton";
import { TerminalPanel } from "../components/TerminalPanel";
import type { AudioSettings } from "../audio/audioSettings";
import { playMenuConfirmSound } from "../audio/menuAudio";

type CharacterSheetModalProps = {
  audioSettings: AudioSettings;
  onClose: () => void;
  stats: Stats;
};

export function CharacterSheetModal({
  audioSettings,
  onClose,
  stats,
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
                  ? stats.conditions.join(", ")
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
