import { useEffect, useRef } from "react";
import type { CombatActionDef } from "../../engine";
import type { AudioSettings } from "../audio/audioSettings";
import { playMenuConfirmSound } from "../audio/menuAudio";
import { TerminalButton } from "../components/TerminalButton";
import { TerminalPanel } from "../components/TerminalPanel";

type CombatActionDetailsModalProps = {
  action: CombatActionDef;
  audioSettings: AudioSettings;
  onClose: () => void;
};

export function CombatActionDetailsModal({
  action,
  audioSettings,
  onClose,
}: CombatActionDetailsModalProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    containerRef.current?.focus();
  }, []);

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
      onKeyDown={(event) => {
        event.stopPropagation();
        if (event.key === "Escape") {
          event.preventDefault();
          handleClose();
        }
      }}
      ref={containerRef}
      role="dialog"
      aria-modal="true"
      aria-label={`${action.name} details`}
      tabIndex={-1}
      style={{ outline: "none" }}
    >
      <TerminalPanel
        className="stats-modal stats-modal--combat-action"
        onClick={(event) => event.stopPropagation()}
      >
        <p className="terminal-kicker">COMBAT ACTION</p>
        <h2 className="terminal-heading-md">{action.name}</h2>

        <div className="combat-action-details">
          <p className="combat-action-details__summary">{action.summary}</p>

          <section className="combat-action-details__section">
            <h3 className="stats-modal__subtitle">Formula</h3>
            <p>{action.formula}</p>
          </section>

          <section className="combat-action-details__section">
            <h3 className="stats-modal__subtitle">Effects</h3>
            <ul className="combat-action-details__list">
              {action.effects.map((effect) => (
                <li key={effect}>{effect}</li>
              ))}
            </ul>
          </section>

          <section className="combat-action-details__section">
            <h3 className="stats-modal__subtitle">Details</h3>
            {action.details.map((detail) => (
              <p key={detail}>{detail}</p>
            ))}
          </section>
        </div>

        <div className="stats-modal__actions">
          <TerminalButton onClick={handleClose}>Close [Esc]</TerminalButton>
        </div>
      </TerminalPanel>
    </div>
  );
}
