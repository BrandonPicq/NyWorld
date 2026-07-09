import { useEffect, useRef, useState } from "react";
import type { GameCommand, SequenceMinigameSpec } from "../../../engine";
import type { KeyboardLayout } from "../../controls/keyboardLayout";
import type { AudioSettings } from "../../audio/audioSettings";
import { playQteKeySound, playQteErrorSound } from "../../audio/menuAudio";
import { ARROW_GLYPHS, mapKeyToDirection } from "./qteInput";

type SequenceMinigameProps = {
  phase: "player_qte" | "enemy_qte";
  spec: SequenceMinigameSpec;
  executeCommand: (command: GameCommand) => void;
  keyboardLayout: KeyboardLayout;
  audioSettings: AudioSettings;
};

/**
 * Renders and drives the arrow-key sequence race (the original QTE mechanic).
 *
 * The engine owns the challenge parameters (via the `sequence` minigame spec);
 * this component runs the real-time loop, matches keys, and reports the
 * normalized `SubmitCombatQte` result. It never decides damage or which
 * minigame runs.
 */
export function SequenceMinigame({
  phase,
  spec,
  executeCommand,
  keyboardLayout,
  audioSettings,
}: SequenceMinigameProps) {
  const { challenge, sequence: qteSequence } = spec;
  const isHidden = spec.hidden === true;
  const opponentSpeed = challenge.opponentSpeed;
  // Calculate opponent key delay: faster speed = shorter delay
  const opponentKeyDelayMs = Math.max(400, 1000 - opponentSpeed * 40);
  const playerSequenceLength = challenge.playerSequenceLength;
  const opponentSequenceLength = challenge.opponentSequenceLength;
  const timeLimitMs = challenge.timeLimitMs;
  const initialInputIndex = Math.min(
    playerSequenceLength,
    Math.max(0, spec.initialInputIndex ?? 0),
  );

  const [playerInputIndex, setPlayerInputIndex] = useState(initialInputIndex);
  const [timeElapsed, setTimeElapsed] = useState(0);
  const [mistakes, setMistakes] = useState(0);

  // Real-time loop refs to avoid stale closures
  const playerInputIndexRef = useRef(initialInputIndex);
  const mistakesRef = useRef(0);
  const requestRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const submittedRef = useRef(false);

  // Reset states on phase changes
  useEffect(() => {
    setPlayerInputIndex(initialInputIndex);
    playerInputIndexRef.current = initialInputIndex;
    setTimeElapsed(0);
    setMistakes(0);
    mistakesRef.current = 0;
    submittedRef.current = false;
    startTimeRef.current = null;

    if (requestRef.current) {
      cancelAnimationFrame(requestRef.current);
      requestRef.current = null;
    }
  }, [phase, initialInputIndex]);

  // Real-time animation loop for QTE timer and opponent progress
  useEffect(() => {
    function updateTimer(timestamp: number) {
      if (!startTimeRef.current) {
        startTimeRef.current = timestamp;
      }
      const elapsed = timestamp - startTimeRef.current;
      setTimeElapsed(elapsed);

      const oppProgress = Math.floor(elapsed / opponentKeyDelayMs);

      // Check if opponent finished first
      if (oppProgress >= opponentSequenceLength && !submittedRef.current) {
        submittedRef.current = true;
        if (requestRef.current) cancelAnimationFrame(requestRef.current);

        const currentIdx = playerInputIndexRef.current;
        const advantage = -(playerSequenceLength - currentIdx);

        executeCommand({
          type: "SubmitCombatQte",
          completed: false,
          inputAdvantage: advantage,
          mistakes: mistakesRef.current,
          progressIndex: currentIdx,
        });
        return;
      }

      // Check if time limit ran out
      if (elapsed >= timeLimitMs && !submittedRef.current) {
        submittedRef.current = true;
        if (requestRef.current) cancelAnimationFrame(requestRef.current);

        const currentIdx = playerInputIndexRef.current;
        const advantage = -(playerSequenceLength - currentIdx);

        executeCommand({
          type: "SubmitCombatQte",
          completed: false,
          inputAdvantage: advantage,
          mistakes: mistakesRef.current,
          progressIndex: currentIdx,
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
    playerSequenceLength,
    opponentSequenceLength,
    timeLimitMs,
    executeCommand,
  ]);

  // Player QTE keyboard input matching
  useEffect(() => {
    function handleQteKeys(e: KeyboardEvent) {
      const inputDir = mapKeyToDirection(e, keyboardLayout);

      if (!inputDir) return;
      e.preventDefault();

      const currentIdx = playerInputIndexRef.current;
      const expectedDir = qteSequence[currentIdx];

      if (inputDir === expectedDir) {
        if (audioSettings.soundEnabled) {
          playQteKeySound(inputDir);
        }

        const nextIndex = currentIdx + 1;
        setPlayerInputIndex(nextIndex);
        playerInputIndexRef.current = nextIndex;

        // Check if player completed the sequence
        if (nextIndex >= playerSequenceLength && !submittedRef.current) {
          submittedRef.current = true;
          if (requestRef.current) cancelAnimationFrame(requestRef.current);

          const oppProgress = Math.floor(timeElapsed / opponentKeyDelayMs);
          const advantage = opponentSequenceLength - oppProgress;

          executeCommand({
            type: "SubmitCombatQte",
            completed: true,
            inputAdvantage: advantage,
            mistakes: mistakesRef.current,
            progressIndex: nextIndex,
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

          // Failed immediately due to 2 mistakes
          const advantage = -(playerSequenceLength - currentIdx);
          executeCommand({
            type: "SubmitCombatQte",
            completed: false,
            inputAdvantage: advantage,
            mistakes: nextMistakes,
            progressIndex: currentIdx,
          });
        }
      }
    }

    window.addEventListener("keydown", handleQteKeys);
    return () => window.removeEventListener("keydown", handleQteKeys);
  }, [
    phase,
    isHidden,
    qteSequence,
    playerSequenceLength,
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
        {phase === "player_qte"
          ? isHidden
            ? "Execute the memorized pattern:"
            : "Attack! Complete the QTE:"
          : "Defend! Match the keys to block:"}
      </p>

      {/* Arrow Keys Sequence */}
      <div className="combat-qte-sequence">
        {qteSequence.map((dir, idx) => {
          let statusClass = "combat-keycap--pending";
          if (idx < playerInputIndex) {
            statusClass = "combat-keycap--success";
          }
          return (
            <span key={idx} className={`combat-keycap ${statusClass}`}>
              {formatSequenceKeycap({
                dir,
                idx,
                isHidden,
                playerInputIndex,
                revealedInputIndex: spec.revealedInputIndex,
              })}
            </span>
          );
        })}
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
              style={{ width: `${(playerInputIndex / playerSequenceLength) * 100}%` }}
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

function formatSequenceKeycap({
  dir,
  idx,
  isHidden,
  playerInputIndex,
  revealedInputIndex,
}: {
  dir: string;
  idx: number;
  isHidden: boolean;
  playerInputIndex: number;
  revealedInputIndex?: number;
}): string {
  if (!isHidden) {
    return ARROW_GLYPHS[dir] || dir.toUpperCase();
  }
  if (idx < playerInputIndex) {
    return "✓";
  }
  if (idx === revealedInputIndex) {
    return ARROW_GLYPHS[dir] || dir.toUpperCase();
  }
  return "?";
}
