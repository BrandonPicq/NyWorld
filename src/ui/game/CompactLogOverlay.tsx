import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { LogEntry } from "../../engine";
import type { MapCameraCellRect } from "../../rendering/mapCamera";
import {
  COMPACT_LOG_DURATION_MS,
  formatGameLogEntry,
  getCompactGameLogEntries,
  hasNewGameLogEntry,
  overlayRectsOverlap,
} from "./gameLogModel";

type CompactLogOverlayProps = {
  hidden?: boolean;
  log: LogEntry[];
  playerRect?: MapCameraCellRect;
};

/** Shows the newest log tail briefly without replacing the persisted history. */
export function CompactLogOverlay({
  hidden = false,
  log,
  playerRect,
}: CompactLogOverlayProps) {
  const previousLogRef = useRef<LogEntry[] | null>(null);
  const dismissTimerRef = useRef<number | undefined>(undefined);
  const overlayRef = useRef<HTMLDivElement>(null);
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [isRaised, setIsRaised] = useState(false);

  useEffect(() => {
    const previous = previousLogRef.current;
    previousLogRef.current = log;
    if (!hasNewGameLogEntry(previous, log)) return;

    setEntries(getCompactGameLogEntries(log));
    if (dismissTimerRef.current !== undefined) {
      window.clearTimeout(dismissTimerRef.current);
    }
    dismissTimerRef.current = window.setTimeout(() => {
      setEntries([]);
      dismissTimerRef.current = undefined;
    }, COMPACT_LOG_DURATION_MS);
  }, [log]);

  useLayoutEffect(() => {
    if (hidden || entries.length === 0 || !playerRect) {
      setIsRaised(false);
      return;
    }

    const overlay = overlayRef.current;
    const parent = overlay?.parentElement;
    if (!overlay || !parent) return;

    // The comparison always uses the default lower-right rectangle, not the
    // currently raised one, so the layout cannot oscillate between both states.
    const defaultRect = {
      left: parent.clientWidth - overlay.offsetWidth - 16,
      top: parent.clientHeight - overlay.offsetHeight - 16,
      width: overlay.offsetWidth,
      height: overlay.offsetHeight,
    };
    const shouldRaise = overlayRectsOverlap(playerRect, defaultRect, 16);
    setIsRaised((current) => (current === shouldRaise ? current : shouldRaise));
  }, [entries, hidden, playerRect]);

  useEffect(
    () => () => {
      if (dismissTimerRef.current !== undefined) {
        window.clearTimeout(dismissTimerRef.current);
      }
    },
    [],
  );

  if (hidden || entries.length === 0) return null;

  const className = [
    "compact-log-overlay",
    isRaised ? "compact-log-overlay--raised" : undefined,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={className} ref={overlayRef} role="status" aria-live="polite">
      {entries.map((entry, index) => (
        <p className="compact-log-overlay__entry" key={`${entry.tick}:${index}:${entry.message}`}>
          {formatGameLogEntry(entry)}
        </p>
      ))}
    </div>
  );
}
