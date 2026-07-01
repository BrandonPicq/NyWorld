import { TerminalPanel } from "../components/TerminalPanel";
import { TerminalMenu } from "../components/TerminalMenu";
import type { AudioSettings } from "../audio/audioSettings";
import { playMenuConfirmSound, playMenuMoveSound } from "../audio/menuAudio";

type InteractionChoice = {
  id: string;
  label: string;
};

type InteractionChoiceModalProps = {
  audioSettings: AudioSettings;
  choices: InteractionChoice[];
  onSelect: (choiceId: string) => void;
  onClose: () => void;
};

export function InteractionChoiceModal({
  audioSettings,
  choices,
  onSelect,
  onClose,
}: InteractionChoiceModalProps) {
  const menuFeedback = {
    onActivateItem: () => {
      if (audioSettings.soundEnabled) {
        playMenuConfirmSound();
      }
    },
    onMoveSelection: () => {
      if (audioSettings.soundEnabled) {
        playMenuMoveSound();
      }
    },
  };

  const handleClose = () => {
    if (audioSettings.soundEnabled) {
      playMenuConfirmSound();
    }
    onClose();
  };

  return (
    <div
      className="modal-overlay"
      role="dialog"
      aria-modal="true"
      onClick={handleClose}
      onKeyDown={(e) => {
        e.stopPropagation();
      }}
    >
      <TerminalPanel
        className="stats-modal"
        style={{ maxWidth: "360px" }}
        onClick={(e) => e.stopPropagation()}
      >
        <p className="terminal-kicker">INTERACTION AMBIGUITY</p>
        <h2 className="terminal-heading-md" style={{ marginBottom: "var(--space-4)" }}>
          What do you want to do?
        </h2>

        <TerminalMenu
          ariaLabel="Interaction choices"
          items={choices.map((choice) => ({
            label: choice.label,
            onSelect: () => {
              onSelect(choice.id);
            },
          }))}
          {...menuFeedback}
          onBack={handleClose}
        />
      </TerminalPanel>
    </div>
  );
}
