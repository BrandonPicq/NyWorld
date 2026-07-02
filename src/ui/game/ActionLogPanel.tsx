import type { RefObject } from "react";
import { createWorldTimeSnapshot, type LogEntry } from "../../engine";
import { TerminalPanel } from "../components/TerminalPanel";

type ActionLogPanelProps = {
  log: LogEntry[];
  logRef: RefObject<HTMLDivElement | null>;
  className?: string;
};

export function ActionLogPanel({ log, logRef, className }: ActionLogPanelProps) {
  return (
    <TerminalPanel className={className}>
      <p className="terminal-kicker">CHRONICLE</p>
      <h2 className="terminal-heading-sm">Action Log</h2>

      <div
        className="game-screen__log"
        ref={logRef}
        role="log"
        aria-label="Game log"
      >
        {log.map((entry, i) => (
          <p key={i} className="game-screen__log-entry">
            <span className="game-screen__log-time">
              [{createWorldTimeSnapshot(entry.worldTimeMinutes).timeLabel}]
            </span>{" "}
            {entry.message}
          </p>
        ))}
      </div>
    </TerminalPanel>
  );
}
