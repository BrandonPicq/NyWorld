import { TerminalPanel } from "../components/TerminalPanel";
import { TerminalMenu } from "../components/TerminalMenu";
import type { AudioSettings } from "../audio/audioSettings";
import { playMenuConfirmSound, playMenuMoveSound } from "../audio/menuAudio";

type PauseModalProps = {
  audioSettings: AudioSettings;
  onClose: () => void;
  onOpenOptions: () => void;
  onQuit: () => void;
};

export function PauseModal({
  audioSettings,
  onClose,
  onOpenOptions,
  onQuit,
}: PauseModalProps) {
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

  const menuItems = [
    {
      label: "Resume",
      onSelect: () => onClose(),
    },
    {
      label: "Options",
      onSelect: () => onOpenOptions(),
    },
    {
      label: "Quit to Title",
      onSelect: () => onQuit(),
    },
  ];

  return (
    <div
      className="modal-overlay"
      role="dialog"
      aria-modal="true"
      onClick={handleClose}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          handleClose();
        }
        e.stopPropagation();
      }}
    >
      <TerminalPanel
        className="stats-modal"
        style={{ maxWidth: "280px" }}
        onClick={(e) => e.stopPropagation()}
      >
        <p className="terminal-kicker">GAME SUSPENDED</p>
        <h2 className="terminal-heading-md" style={{ marginBottom: "var(--space-4)" }}>
          Paused
        </h2>

        <TerminalMenu
          ariaLabel="Pause choices"
          items={menuItems}
          {...menuFeedback}
          onBack={handleClose}
          onBackAction={() => {
            if (audioSettings.soundEnabled) {
              playMenuConfirmSound();
            }
          }}
        />
      </TerminalPanel>
    </div>
  );
}
