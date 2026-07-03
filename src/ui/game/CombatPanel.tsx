import { useEffect, useState, useRef } from "react";
import type { Stats } from "../../engine/components";
import type { CombatState } from "../../engine/GameplayEngine";
import type { GameCommand } from "../../engine";
import type { KeyboardLayout } from "../controls/keyboardLayout";
import type { AudioSettings } from "../audio/audioSettings";
import { playQteKeySound, playQteErrorSound } from "../audio/menuAudio";
import { TerminalPanel } from "../components/TerminalPanel";
import { TerminalButton } from "../components/TerminalButton";

type CombatPanelProps = {
  combatState: CombatState;
  playerStats: Stats;
  executeCommand: (command: GameCommand) => void;
  keyboardLayout: KeyboardLayout;
  audioSettings: AudioSettings;
};

const ARROW_GLYPHS: Record<string, string> = {
  up: "↑",
  down: "↓",
  left: "←",
  right: "→",
};

export function CombatPanel({
  combatState,
  playerStats,
  executeCommand,
  keyboardLayout,
  audioSettings,
}: CombatPanelProps) {
  const { phase, opponentName, opponentStats, qteSequence, qteChallenge } = combatState;

  // QTE player progress & mistakes
  const [playerInputIndex, setPlayerInputIndex] = useState(0);
  const [timeElapsed, setTimeElapsed] = useState(0);
  const [mistakes, setMistakes] = useState(0);

  // Real-time loop refs to avoid stale closures
  const playerInputIndexRef = useRef(0);
  const mistakesRef = useRef(0);
  const requestRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const submittedRef = useRef(false);

  const opponentSpeed = qteChallenge?.opponentSpeed ?? 10;
  // Calculate opponent key delay: faster speed = shorter delay
  const opponentKeyDelayMs = Math.max(400, 1000 - opponentSpeed * 40);
  const playerSequenceLength = qteChallenge?.playerSequenceLength ?? qteSequence?.length ?? 5;
  const opponentSequenceLength = qteChallenge?.opponentSequenceLength ?? 5;
  const timeLimitMs = qteChallenge?.timeLimitMs ?? 5000;

  // Reset states on phase changes
  useEffect(() => {
    setPlayerInputIndex(0);
    playerInputIndexRef.current = 0;
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

  // Action selection shortcuts
  useEffect(() => {
    if (phase !== "action_selection") return;

    function handleSelectionKeys(e: KeyboardEvent) {
      const key = e.key.toLowerCase();
      if (key === "p") {
        e.preventDefault();
        executeCommand({ type: "SelectCombatAction", actionKind: "physical" });
      } else if (key === "m") {
        e.preventDefault();
        executeCommand({ type: "SelectCombatAction", actionKind: "magical" });
      } else if (key === "f") {
        e.preventDefault();
        executeCommand({ type: "SelectCombatAction", actionKind: "flee" });
      }
    }

    window.addEventListener("keydown", handleSelectionKeys);
    return () => window.removeEventListener("keydown", handleSelectionKeys);
  }, [phase, executeCommand]);

  // Victory / Defeat space/enter keys to conclude
  useEffect(() => {
    if (phase !== "victory" && phase !== "defeat") return;

    function handleConcludeKeys(e: KeyboardEvent) {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        executeCommand({ type: "ConcludeCombat" });
      }
    }

    window.addEventListener("keydown", handleConcludeKeys);
    return () => window.removeEventListener("keydown", handleConcludeKeys);
  }, [phase, executeCommand]);

  // Opponent turn transitional pause
  useEffect(() => {
    if (phase !== "opponent_turn_transition") return;

    const timer = setTimeout(() => {
      executeCommand({ type: "StartOpponentTurn" });
    }, 1500);

    return () => clearTimeout(timer);
  }, [phase, executeCommand]);

  // Real-time animation loop for QTE timer and opponent progress
  useEffect(() => {
    if (phase !== "player_qte" && phase !== "enemy_qte") return;

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
  }, [phase, opponentKeyDelayMs, playerSequenceLength, opponentSequenceLength, timeLimitMs, executeCommand]);

  // Player QTE keyboard input matching
  useEffect(() => {
    if ((phase !== "player_qte" && phase !== "enemy_qte") || !qteSequence) return;

    function handleQteKeys(e: KeyboardEvent) {
      const key = e.key.toLowerCase();
      let inputDir: "up" | "down" | "left" | "right" | null = null;

      // Map arrow keys and WASD/ZSQD
      if (e.key === "ArrowUp" || (keyboardLayout === "azerty" ? key === "z" : key === "w")) {
        inputDir = "up";
      } else if (e.key === "ArrowDown" || key === "s") {
        inputDir = "down";
      } else if (e.key === "ArrowLeft" || (keyboardLayout === "azerty" ? key === "q" : key === "a")) {
        inputDir = "left";
      } else if (e.key === "ArrowRight" || key === "d") {
        inputDir = "right";
      }

      if (!inputDir) return;
      e.preventDefault();

      const currentIdx = playerInputIndexRef.current;
      const expectedDir = qteSequence ? qteSequence[currentIdx] : undefined;

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
          });
        }
      }
    }

    window.addEventListener("keydown", handleQteKeys);
    return () => window.removeEventListener("keydown", handleQteKeys);
  }, [phase, qteSequence, playerSequenceLength, opponentSequenceLength, timeElapsed, opponentKeyDelayMs, executeCommand, keyboardLayout, audioSettings.soundEnabled]);

  const opponentCompleted = Math.min(opponentSequenceLength, Math.floor(timeElapsed / opponentKeyDelayMs));

  return (
    <TerminalPanel className="combat-panel">
      <div className="combat-layout">
        {/* Header */}
        <div className="combat-header">
          <span className="terminal-kicker">COMBAT ENCOUNTER</span>
          <h2 className="terminal-heading-md">VERSUS {opponentName.toUpperCase()}</h2>
        </div>

        {/* Combat Statuses */}
        <div className="combat-stats-row">
          {/* Player stats */}
          <div className="combat-stats-box combat-stats-box--player">
            <h3 className="combat-stats-title">You</h3>
            <div className="combat-bar-row">
              <span>HP</span>
              <div className="combat-bar-container">
                <div
                  className="combat-bar-fill combat-bar-fill--hp"
                  style={{ width: `${(playerStats.resources.hp / playerStats.resources.maxHp) * 100}%` }}
                />
                <span className="combat-bar-text">
                  {playerStats.resources.hp} / {playerStats.resources.maxHp}
                </span>
              </div>
            </div>
            <div className="combat-bar-row">
              <span>MP</span>
              <div className="combat-bar-container">
                <div
                  className="combat-bar-fill combat-bar-fill--mp"
                  style={{ width: `${(playerStats.resources.mp / playerStats.resources.maxMp) * 100}%` }}
                />
                <span className="combat-bar-text">
                  {playerStats.resources.mp} / {playerStats.resources.maxMp}
                </span>
              </div>
            </div>
            <div className="combat-bar-row">
              <span>SP</span>
              <div className="combat-bar-container">
                <div
                  className="combat-bar-fill combat-bar-fill--sp"
                  style={{ width: `${(playerStats.resources.sp / playerStats.resources.maxSp) * 100}%` }}
                />
                <span className="combat-bar-text">
                  {playerStats.resources.sp} / {playerStats.resources.maxSp}
                </span>
              </div>
            </div>
          </div>

          {/* Opponent stats */}
          <div className="combat-stats-box combat-stats-box--opponent">
            <h3 className="combat-stats-title">{opponentName}</h3>
            <div className="combat-bar-row">
              <span>HP</span>
              <div className="combat-bar-container">
                <div
                  className="combat-bar-fill combat-bar-fill--opponent-hp"
                  style={{ width: `${(opponentStats.resources.hp / opponentStats.resources.maxHp) * 100}%` }}
                />
                <span className="combat-bar-text">
                  {opponentStats.resources.hp} / {opponentStats.resources.maxHp}
                </span>
              </div>
            </div>
            <div className="combat-stats-details">
              <span>ATK: {opponentStats.combat.attack}</span>
              <span>DEF: {opponentStats.combat.defense}</span>
              <span>AGI: {opponentStats.attributes.agility}</span>
              <span>SPI: {opponentStats.attributes.spirit}</span>
            </div>
          </div>
        </div>

        {/* Phase Main Rendering Area */}
        <div className="combat-phase-area">
          {phase === "action_selection" && (
            <div className="combat-actions-menu">
              <p className="combat-phase-instruction">Choose your combat action:</p>
              <div className="combat-actions-buttons">
                <TerminalButton
                  onClick={() => executeCommand({ type: "SelectCombatAction", actionKind: "physical" })}
                >
                  [P] Physical Attack
                </TerminalButton>
                <TerminalButton
                  onClick={() => executeCommand({ type: "SelectCombatAction", actionKind: "magical" })}
                >
                  [M] Magical Attack
                </TerminalButton>
                <TerminalButton
                  onClick={() => executeCommand({ type: "SelectCombatAction", actionKind: "flee" })}
                >
                  [F] Flee
                </TerminalButton>
              </div>
            </div>
          )}

          {(phase === "player_qte" || phase === "enemy_qte") && qteSequence && (
            <div className="combat-qte-section">
              <p className="combat-phase-instruction">
                {phase === "player_qte" ? "Attack! Complete the QTE:" : "Defend! Match the keys to block:"}
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
                      {ARROW_GLYPHS[dir] || dir.toUpperCase()}
                    </span>
                  );
                })}
              </div>

              {/* Mistakes display */}
              <div className={`combat-loot-text ${mistakes > 0 ? "combat-result-title--defeat" : ""}`} style={{ fontSize: "0.95rem" }}>
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
          )}

          {phase === "opponent_turn_transition" && (
            <div className="combat-result-menu">
              <h3 className="combat-result-title" style={{ color: "var(--color-text-soft)" }}>PREPARING</h3>
              <p className="combat-result-text">The {opponentName} is preparing to attack...</p>
              <p className="combat-loot-text">Get ready to defend!</p>
            </div>
          )}

          {phase === "victory" && (
            <div className="combat-result-menu">
              <h3 className="combat-result-title combat-result-title--victory">VICTORY</h3>
              <p className="combat-result-text">You successfully defeated the {opponentName}!</p>
              {opponentName.toLowerCase() === "slime" && (
                <p className="combat-loot-text">Loot found: 1x [Slime Remains]</p>
              )}
              {opponentName.toLowerCase() === "kobold" && (
                <p className="combat-loot-text">Loot found: 1x [Kobold Remains]</p>
              )}
              <div className="combat-result-actions">
                <TerminalButton onClick={() => executeCommand({ type: "ConcludeCombat" })}>
                  Conclude Combat [Space]
                </TerminalButton>
              </div>
            </div>
          )}

          {phase === "defeat" && (
            <div className="combat-result-menu">
              <h3 className="combat-result-title combat-result-title--defeat">DEFEAT</h3>
              <p className="combat-result-text">You were knocked unconscious by the {opponentName}...</p>
              <p className="combat-loot-text">Teleporting back to safety with partial recovery.</p>
              <div className="combat-result-actions">
                <TerminalButton onClick={() => executeCommand({ type: "ConcludeCombat" })}>
                  Conclude Combat [Space]
                </TerminalButton>
              </div>
            </div>
          )}
        </div>
      </div>
    </TerminalPanel>
  );
}
