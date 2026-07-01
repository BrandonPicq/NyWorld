import type { Stats } from "../../engine/components";
import { TerminalButton } from "../components/TerminalButton";
import { TerminalPanel } from "../components/TerminalPanel";
import { capitalize } from "../controls/statsFormatter";
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
      <TerminalPanel className="stats-modal" onClick={(e) => e.stopPropagation()}>
        <p className="terminal-kicker">CHARACTER PROFILE</p>
        <h2 className="terminal-heading-md">Character Sheet</h2>

        <div className="stats-modal__content">
          <div className="stats-modal__section">
            <h3 className="stats-modal__subtitle">Attributes</h3>
            <div className="stats-modal__grid">
              {Object.entries(stats.attributes).map(([key, val]) => (
                <div key={key} className="stats-modal__row">
                  <span className="stats-modal__attr-name">
                    {capitalize(key)}
                  </span>
                  <span className="stats-modal__attr-value">{val}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="stats-modal__section">
            <h3 className="stats-modal__subtitle">Academy Status</h3>
            <div className="stats-modal__academic">
              <p>
                <strong>Title:</strong> {stats.academicTitle}
              </p>
              <p>
                <strong>Studies Progress:</strong> {stats.academicProgress}%
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
