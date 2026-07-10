import { useEffect, useRef } from "react";
import type { LogEntry } from "../../engine";
import { TerminalButton } from "../components/TerminalButton";
import { TerminalPanel } from "../components/TerminalPanel";
import { formatGameLogEntry } from "./gameLogModel";

type GameLogModalProps = {
  isOpen: boolean;
  log: LogEntry[];
  onClose: () => void;
};

/** Read-only full history modal for the persisted gameplay log. */
export function GameLogModal({ isOpen, log, onClose }: GameLogModalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    containerRef.current?.focus();
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [isOpen, log.length]);

  if (!isOpen) return null;

  return (
    <div
      aria-modal="true"
      className="modal-overlay game-log-modal-overlay"
      onClick={onClose}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          onClose();
        }
      }}
      ref={containerRef}
      role="dialog"
      tabIndex={-1}
    >
      <TerminalPanel
        className="game-log-modal"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="game-log-modal__header">
          <div>
            <p className="terminal-kicker">CHRONICLE</p>
            <h2 className="terminal-heading-md">Logs</h2>
          </div>
          <TerminalButton onClick={onClose}>Close</TerminalButton>
        </header>
        <div
          aria-label="Complete game log"
          className="game-log-modal__entries"
          ref={logRef}
          role="log"
        >
          {log.length === 0 ? (
            <p className="game-log-modal__empty">No logs yet.</p>
          ) : (
            log.map((entry, index) => (
              <p className="game-log-modal__entry" key={`${entry.tick}:${index}:${entry.message}`}>
                {formatGameLogEntry(entry)}
              </p>
            ))
          )}
        </div>
      </TerminalPanel>
    </div>
  );
}
