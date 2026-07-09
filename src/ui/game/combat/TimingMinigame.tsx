import { useEffect, useRef, useState } from "react";
import {
  classifyTimingPress,
  createTimingWindowMotion,
  mapTimingVolley,
  stepTimingWindowMotion,
  type GameCommand,
  type TimingMinigameSpec,
  type TimingShotOutcome,
  type TimingWindowMotion,
} from "../../../engine";
import type { KeyboardLayout } from "../../controls/keyboardLayout";
import type { AudioSettings } from "../../audio/audioSettings";
import { playQteKeySound, playQteErrorSound } from "../../audio/menuAudio";
import { mapKeyToDirection } from "./qteInput";

type TimingMinigameProps = {
  phase: "player_qte" | "enemy_qte";
  spec: TimingMinigameSpec;
  executeCommand: (command: GameCommand) => void;
  keyboardLayout: KeyboardLayout;
  audioSettings: AudioSettings;
};

const OUTCOME_GLYPH: Record<TimingShotOutcome, string> = {
  critical: "★",
  great: "●",
  rate: "×",
};

/**
 * Renders and drives the bow timing volley (the bow archetype mechanic).
 *
 * The engine owns the shot count and window sizes (via the `timing` spec); this
 * component sweeps a cursor per shot and reports the normalized
 * `SubmitCombatQte` result. There is no opponent race: the advantage comes
 * entirely from shot quality (ADR 0009).
 */
export function TimingMinigame({
  phase,
  spec,
  executeCommand,
  keyboardLayout,
  audioSettings,
}: TimingMinigameProps) {
  const {
    volleySize,
    sweepMs,
    windowTravelSpeed,
    greatWindow,
    criticalWindow,
  } = spec;

  const [shotIndex, setShotIndex] = useState(0);
  const [cursorPos, setCursorPos] = useState(0);
  const [windowCenter, setWindowCenter] = useState(0.5);
  const [outcomes, setOutcomes] = useState<TimingShotOutcome[]>([]);

  const shotIndexRef = useRef(0);
  const outcomesRef = useRef<TimingShotOutcome[]>([]);
  const shotStartRef = useRef<number | null>(null);
  const lastFrameRef = useRef<number | null>(null);
  const motionRef = useRef<TimingWindowMotion>(createTimingWindowMotion());
  const requestRef = useRef<number | null>(null);
  const submittedRef = useRef(false);

  // Reset state on phase changes
  useEffect(() => {
    setShotIndex(0);
    shotIndexRef.current = 0;
    setCursorPos(0);
    setWindowCenter(0.5);
    setOutcomes([]);
    outcomesRef.current = [];
    submittedRef.current = false;
    shotStartRef.current = null;
    lastFrameRef.current = null;
    motionRef.current = createTimingWindowMotion();

    if (requestRef.current) {
      cancelAnimationFrame(requestRef.current);
      requestRef.current = null;
    }
  }, [phase]);

  useEffect(() => {
    function finish() {
      submittedRef.current = true;
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
      const result = mapTimingVolley(outcomesRef.current);
      executeCommand({
        type: "SubmitCombatQte",
        completed: result.completed,
        inputAdvantage: result.inputAdvantage,
        mistakes: result.mistakes,
      });
    }

    /** Records one shot; returns true when the volley is finished. */
    function recordShot(outcome: TimingShotOutcome): boolean {
      const nextOutcomes = [...outcomesRef.current, outcome];
      outcomesRef.current = nextOutcomes;
      setOutcomes(nextOutcomes);

      const nextShot = shotIndexRef.current + 1;
      shotIndexRef.current = nextShot;
      setShotIndex(nextShot);
      shotStartRef.current = null;
      setCursorPos(0);
      // Each shot gets a fresh window: centered, random drift direction.
      motionRef.current = createTimingWindowMotion();
      setWindowCenter(motionRef.current.center);

      if (nextShot >= volleySize) {
        finish();
        return true;
      }
      return false;
    }

    function loop(timestamp: number) {
      if (submittedRef.current) return;
      if (!shotStartRef.current) {
        shotStartRef.current = timestamp;
      }
      const elapsedMs = timestamp - shotStartRef.current;
      const pos = elapsedMs / sweepMs;
      setCursorPos(Math.min(1, pos));

      const deltaMs =
        lastFrameRef.current === null ? 0 : timestamp - lastFrameRef.current;
      lastFrameRef.current = timestamp;
      motionRef.current = stepTimingWindowMotion(
        motionRef.current,
        deltaMs,
        windowTravelSpeed,
        greatWindow,
      );
      setWindowCenter(motionRef.current.center);

      if (pos >= 1) {
        // The cursor swept past the gauge without a shot: a miss.
        if (recordShot("rate")) return;
      }

      requestRef.current = requestAnimationFrame(loop);
    }

    function handleFire(e: KeyboardEvent) {
      const isFire =
        e.key === " " ||
        e.key === "Spacebar" ||
        mapKeyToDirection(e, keyboardLayout) !== null;
      if (!isFire) return;
      e.preventDefault();
      if (submittedRef.current || shotStartRef.current === null) return;

      const pos = Math.min(
        1,
        (performance.now() - shotStartRef.current) / sweepMs,
      );
      const outcome = classifyTimingPress(
        pos,
        greatWindow,
        criticalWindow,
        motionRef.current.center,
      );

      if (audioSettings.soundEnabled) {
        if (outcome === "rate") {
          playQteErrorSound();
        } else {
          playQteKeySound("up");
        }
      }

      recordShot(outcome);
    }

    requestRef.current = requestAnimationFrame(loop);
    window.addEventListener("keydown", handleFire);

    return () => {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
      window.removeEventListener("keydown", handleFire);
    };
  }, [
    phase,
    volleySize,
    sweepMs,
    windowTravelSpeed,
    greatWindow,
    criticalWindow,
    executeCommand,
    keyboardLayout,
    audioSettings.soundEnabled,
  ]);

  const greatLeft = (windowCenter - greatWindow / 2) * 100;
  const criticalLeft = (windowCenter - criticalWindow / 2) * 100;
  const displayShot = Math.min(shotIndex + 1, volleySize);

  return (
    <div className="combat-qte-section">
      <p className="combat-phase-instruction">
        Fire! Press when the cursor crosses the window:
      </p>

      {/* Volley shot markers */}
      <div className="combat-qte-sequence">
        {Array.from({ length: volleySize }, (_, idx) => {
          const outcome = outcomes[idx];
          const statusClass = outcome
            ? `combat-timing-pip--${outcome}`
            : "combat-timing-pip--pending";
          return (
            <span key={idx} className={`combat-timing-pip ${statusClass}`}>
              {outcome ? OUTCOME_GLYPH[outcome] : idx + 1}
            </span>
          );
        })}
      </div>

      <div
        className="combat-loot-text"
        style={{ fontSize: "0.95rem" }}
      >
        Shot {displayShot} / {volleySize}
      </div>

      {/* Timing gauge with great/critical windows and a sweeping cursor */}
      <div className="combat-timing-gauge">
        <div
          className="combat-timing-window combat-timing-window--great"
          style={{ left: `${greatLeft}%`, width: `${greatWindow * 100}%` }}
        />
        <div
          className="combat-timing-window combat-timing-window--critical"
          style={{ left: `${criticalLeft}%`, width: `${criticalWindow * 100}%` }}
        />
        <div
          className="combat-timing-cursor"
          style={{ left: `${cursorPos * 100}%` }}
        />
      </div>
    </div>
  );
}
