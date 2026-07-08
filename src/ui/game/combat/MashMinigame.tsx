import { useEffect, useRef, useState } from "react";
import type { GameCommand, MashMinigameSpec } from "../../../engine";
import type { KeyboardLayout } from "../../controls/keyboardLayout";
import type { AudioSettings } from "../../audio/audioSettings";
import { playQteKeySound, playQteErrorSound } from "../../audio/menuAudio";
import { ARROW_GLYPHS, mapKeyToDirection } from "./qteInput";

type MashMinigameProps = {
  phase: "player_qte" | "enemy_qte";
  spec: MashMinigameSpec;
  executeCommand: (command: GameCommand) => void;
  keyboardLayout: KeyboardLayout;
  audioSettings: AudioSettings;
};

/**
 * Renders and drives the hammer mash (the hammer archetype mechanic).
 *
 * The engine owns the drawn arrow and the target press count (via the `mash`
 * minigame spec); this component runs the real-time loop and reports the
 * normalized `SubmitCombatQte` result using the same race mapping as the
 * sequence mechanic. Pressing any arrow other than the drawn one is a mistake.
 */
export function MashMinigame({
  phase,
  spec,
  executeCommand,
  keyboardLayout,
  audioSettings,
}: MashMinigameProps) {
  const { challenge, arrow, targetPresses } = spec;

  const [presses, setPresses] = useState(0);
  const [timeElapsed, setTimeElapsed] = useState(0);
  const [mistakes, setMistakes] = useState(0);

  // Real-time loop refs to avoid stale closures
  const pressesRef = useRef(0);
  const mistakesRef = useRef(0);
  const requestRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const submittedRef = useRef(false);

  const opponentSpeed = challenge.opponentSpeed;
  const opponentKeyDelayMs = Math.max(400, 1000 - opponentSpeed * 40);
  const opponentSequenceLength = challenge.opponentSequenceLength;
  const timeLimitMs = challenge.timeLimitMs;

  // Reset state on phase changes
  useEffect(() => {
    setPresses(0);
    pressesRef.current = 0;
    setTimeElapsed(0);
    setMistakes(0);
    mistakesRef.current = 0;
    submittedRef.current = false;
    startTimeRef.current = null;

    if (requestRef.current) {
      cancelAnimationFrame(requestRef.current);
      requestRef.current = null;
    }
  }, [phase]);

  // Real-time animation loop for the timer and opponent progress
  useEffect(() => {
    function updateTimer(timestamp: number) {
      if (!startTimeRef.current) {
        startTimeRef.current = timestamp;
      }
      const elapsed = timestamp - startTimeRef.current;
      setTimeElapsed(elapsed);

      const oppProgress = Math.floor(elapsed / opponentKeyDelayMs);

      const opponentFirst = oppProgress >= opponentSequenceLength;
      const timedOut = elapsed >= timeLimitMs;
      if ((opponentFirst || timedOut) && !submittedRef.current) {
        submittedRef.current = true;
        if (requestRef.current) cancelAnimationFrame(requestRef.current);

        const advantage = -(targetPresses - pressesRef.current);
        executeCommand({
          type: "SubmitCombatQte",
          completed: false,
          inputAdvantage: advantage,
          mistakes: mistakesRef.current,
        });
        return;
      }

      requestRef.current = requestAnimationFrame(updateTimer);
    }

    requestRef.current = requestAnimationFrame(updateTimer);

    return () => {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
    };
  }, [
    phase,
    opponentKeyDelayMs,
    opponentSequenceLength,
    timeLimitMs,
    targetPresses,
    executeCommand,
  ]);

  // Keyboard input matching: hammer the drawn arrow, any other arrow is a miss
  useEffect(() => {
    function handleMashKeys(e: KeyboardEvent) {
      const inputDir = mapKeyToDirection(e, keyboardLayout);
      if (!inputDir) return;
      e.preventDefault();

      if (inputDir === arrow) {
        if (audioSettings.soundEnabled) {
          playQteKeySound(inputDir);
        }

        const nextPresses = pressesRef.current + 1;
        setPresses(nextPresses);
        pressesRef.current = nextPresses;

        if (nextPresses >= targetPresses && !submittedRef.current) {
          submittedRef.current = true;
          if (requestRef.current) cancelAnimationFrame(requestRef.current);

          const oppProgress = Math.floor(timeElapsed / opponentKeyDelayMs);
          const advantage = opponentSequenceLength - oppProgress;

          executeCommand({
            type: "SubmitCombatQte",
            completed: true,
            inputAdvantage: advantage,
            mistakes: mistakesRef.current,
          });
        }
      } else {
        if (audioSettings.soundEnabled) {
          playQteErrorSound();
        }

        const nextMistakes = mistakesRef.current + 1;
        setMistakes(nextMistakes);
        mistakesRef.current = nextMistakes;

        if (nextMistakes >= 2 && !submittedRef.current) {
          submittedRef.current = true;
          if (requestRef.current) cancelAnimationFrame(requestRef.current);

          const advantage = -(targetPresses - pressesRef.current);
          executeCommand({
            type: "SubmitCombatQte",
            completed: false,
            inputAdvantage: advantage,
            mistakes: nextMistakes,
          });
        }
      }
    }

    window.addEventListener("keydown", handleMashKeys);
    return () => window.removeEventListener("keydown", handleMashKeys);
  }, [
    phase,
    arrow,
    targetPresses,
    opponentSequenceLength,
    timeElapsed,
    opponentKeyDelayMs,
    executeCommand,
    keyboardLayout,
    audioSettings.soundEnabled,
  ]);

  const opponentCompleted = Math.min(
    opponentSequenceLength,
    Math.floor(timeElapsed / opponentKeyDelayMs),
  );

  return (
    <div className="combat-qte-section">
      <p className="combat-phase-instruction">
        Attack! Hammer the key as fast as you can:
      </p>

      {/* Drawn arrow to hammer */}
      <div className="combat-qte-sequence">
        <span className="combat-keycap combat-keycap--mash">
          {ARROW_GLYPHS[arrow] || arrow.toUpperCase()}
        </span>
      </div>

      {/* Press progress */}
      <div className="combat-mash-progress-row">
        <span>Presses</span>
        <div className="combat-bar-container">
          <div
            className="combat-bar-fill combat-bar-fill--hp"
            style={{ width: `${Math.min(100, (presses / targetPresses) * 100)}%` }}
          />
          <span className="combat-bar-text">
            {Math.min(presses, targetPresses)} / {targetPresses}
          </span>
        </div>
      </div>

      {/* Mistakes display */}
      <div
        className={`combat-loot-text ${mistakes > 0 ? "combat-result-title--defeat" : ""}`}
        style={{ fontSize: "0.95rem" }}
      >
        Mistakes: {mistakes} / 2
      </div>

      {/* Progress bars (Race) */}
      <div className="combat-race-container">
        <div className="combat-race-track">
          <div className="combat-race-label">Your Speed</div>
          <div className="combat-race-bar">
            <div
              className="combat-race-fill combat-race-fill--player"
              style={{ width: `${Math.min(100, (presses / targetPresses) * 100)}%` }}
            />
          </div>
        </div>

        <div className="combat-race-track">
          <div className="combat-race-label">Enemy Speed</div>
          <div className="combat-race-bar">
            <div
              className="combat-race-fill combat-race-fill--opponent"
              style={{ width: `${(opponentCompleted / opponentSequenceLength) * 100}%` }}
            />
          </div>
        </div>

        {/* Countdown Timer */}
        <div className="combat-countdown-row">
          <span>Time Limit</span>
          <div className="combat-time-bar">
            <div
              className="combat-time-fill"
              style={{ width: `${Math.max(0, 100 - (timeElapsed / timeLimitMs) * 100)}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
