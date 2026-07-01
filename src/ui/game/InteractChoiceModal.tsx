import { useEffect, useState } from "react";
import { TerminalButton } from "../components/TerminalButton";
import { TerminalPanel } from "../components/TerminalPanel";

type NpcChoice = {
  npcId: string;
  name: string;
};

type InteractChoiceModalProps = {
  npcs: NpcChoice[];
  onSelect: (npcId: string) => void;
  onClose: () => void;
};

export function InteractChoiceModal({
  npcs,
  onSelect,
  onClose,
}: InteractChoiceModalProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const keyLower = event.key.toLowerCase();

      if (event.key === "ArrowDown" || keyLower === "s") {
        event.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % npcs.length);
      } else if (
        event.key === "ArrowUp" ||
        keyLower === "w" ||
        keyLower === "z"
      ) {
        event.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + npcs.length) % npcs.length);
      } else if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        onSelect(npcs[selectedIndex].npcId);
      } else if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [npcs, selectedIndex, onSelect, onClose]);

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" onClick={onClose}>
      <TerminalPanel
        className="stats-modal"
        style={{ maxWidth: "360px" }}
        onClick={(e) => e.stopPropagation()}
      >
        <p className="terminal-kicker">INTERACTION AMBIGUITY</p>
        <h2 className="terminal-heading-md" style={{ marginBottom: "var(--space-4)" }}>
          Who do you want to talk to?
        </h2>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "var(--space-2)",
            marginBottom: "var(--space-4)",
          }}
        >
          {npcs.map((npc, index) => (
            <TerminalButton
              key={npc.npcId}
              className={index === selectedIndex ? "terminal-button--active" : ""}
              onClick={() => onSelect(npc.npcId)}
              style={{
                textAlign: "left",
                justifyContent: "flex-start",
                paddingLeft: "var(--space-3)",
              }}
            >
              {index === selectedIndex ? "> " : "  "} {npc.name}
            </TerminalButton>
          ))}
        </div>

        <div className="stats-modal__actions">
          <TerminalButton onClick={onClose}>Cancel [Esc]</TerminalButton>
        </div>
      </TerminalPanel>
    </div>
  );
}
