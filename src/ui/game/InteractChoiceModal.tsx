import { TerminalPanel } from "../components/TerminalPanel";
import { TerminalMenu } from "../components/TerminalMenu";
import type { AudioSettings } from "../audio/audioSettings";
import { playMenuConfirmSound, playMenuMoveSound } from "../audio/menuAudio";

type NpcChoice = {
  npcId: string;
  name: string;
};

type InteractChoiceModalProps = {
  audioSettings: AudioSettings;
  npcs: NpcChoice[];
  onSelect: (npcId: string) => void;
  onClose: () => void;
};

export function InteractChoiceModal({
  audioSettings,
  npcs,
  onSelect,
  onClose,
}: InteractChoiceModalProps) {
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
          Who do you want to talk to?
        </h2>

        <TerminalMenu
          ariaLabel="NPC choices"
          items={npcs.map((npc) => ({
            label: npc.name,
            onSelect: () => {
              onSelect(npc.npcId);
            },
          }))}
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
