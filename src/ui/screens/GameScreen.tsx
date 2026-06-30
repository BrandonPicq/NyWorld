import { useCallback, useEffect, useRef, useState } from "react";
import type { GameCommand } from "../../engine/commands";
import { GameplayEngine } from "../../engine/GameplayEngine";
import { loadZone } from "../../engine/zoneLoader";
import type { GameSnapshot } from "../../engine/GameplayEngine";
import { createGridRenderSnapshot } from "../../rendering";
import testZoneData from "../../content/zones/test_zone.json";
import testZone2Data from "../../content/zones/test_zone_2.json";
import type { ZoneData } from "../../engine/ZoneTypes";
import { GameCanvas } from "../components/GameCanvas";
import { TerminalButton } from "../components/TerminalButton";
import { TerminalPanel } from "../components/TerminalPanel";
import {
  getGameCommandForKey,
  getMovementKeyLabel,
} from "../controls/gameInput";
import type { KeyboardLayout } from "../controls/keyboardLayout";
import { formatCurrency, capitalize } from "../controls/statsFormatter";
import type { AudioSettings } from "../audio/audioSettings";
import type { TextSpeed } from "../controls/textSpeed";
import { playTextBleepSound } from "../audio/menuAudio";

type GameScreenProps = {
  audioSettings: AudioSettings;
  keyboardLayout: KeyboardLayout;
  textSpeed: TextSpeed;
  onBackToTitle: () => void;
};

export interface DialogueNode {
  speaker: string;
  text: string;
  pitch: number;
}

const zoneRegistry: Record<string, ZoneData> = {
  test_zone: testZoneData as ZoneData,
  test_zone_2: testZone2Data as ZoneData,
};

export function GameScreen({
  audioSettings,
  keyboardLayout,
  textSpeed,
  onBackToTitle,
}: GameScreenProps) {
  const [snapshot, setSnapshot] = useState<GameSnapshot | null>(null);
  const [isCharacterSheetOpen, setIsCharacterSheetOpen] = useState(false);
  const engineRef = useRef<GameplayEngine | null>(null);
  const logRef = useRef<HTMLDivElement>(null);

  // Dialogue States
  const [activeDialogue, setActiveDialogue] = useState<DialogueNode[] | null>(
    null,
  );
  const [dialogueIndex, setDialogueIndex] = useState(0);
  const [visibleText, setVisibleText] = useState("");
  const [isTyping, setIsTyping] = useState(false);

  const prevZoneIdRef = useRef<string | null>(null);

  const triggerDialogue = useCallback((nodes: DialogueNode[]) => {
    setActiveDialogue(nodes);
    setDialogueIndex(0);
    setVisibleText("");
    setIsTyping(true);
  }, []);

  useEffect(() => {
    const map = loadZone(testZoneData);
    const engine = new GameplayEngine(map, {
      resolveZone: (zoneId) => {
        const zoneData = zoneRegistry[zoneId];
        return zoneData ? loadZone(zoneData) : undefined;
      },
    });
    engineRef.current = engine;
    setSnapshot(engine.getSnapshot());
  }, []);

  const executeCommand = useCallback((command: GameCommand) => {
    const engine = engineRef.current;
    if (!engine) return;
    engine.execute(command);
    setSnapshot(engine.getSnapshot());
  }, []);

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [snapshot?.log]);

  const progressDialogue = useCallback(() => {
    if (!activeDialogue) return;
    const node = activeDialogue[dialogueIndex];
    if (!node) return;

    if (isTyping) {
      // Skip typing: display the full text instantly
      setVisibleText(node.text);
      setIsTyping(false);
    } else {
      const nextIndex = dialogueIndex + 1;
      if (nextIndex < activeDialogue.length) {
        setDialogueIndex(nextIndex);
        setVisibleText("");
        setIsTyping(true);
      } else {
        setActiveDialogue(null);
      }
    }
  }, [activeDialogue, dialogueIndex, isTyping]);

  // Dialogue typing typewriter effect
  useEffect(() => {
    if (!activeDialogue) return;
    const node = activeDialogue[dialogueIndex];
    if (!node) {
      setActiveDialogue(null);
      return;
    }

    if (visibleText.length >= node.text.length) {
      setIsTyping(false);
      return;
    }

    const delay =
      textSpeed === "slow"
        ? 60
        : textSpeed === "fast"
          ? 10
          : textSpeed === "instant"
            ? 0
            : 30;

    if (delay === 0) {
      setVisibleText(node.text);
      setIsTyping(false);
      return;
    }

    const timer = setTimeout(() => {
      const nextChar = node.text[visibleText.length];
      setVisibleText((prev) => prev + nextChar);

      if (nextChar !== " " && audioSettings.soundEnabled) {
        playTextBleepSound(node.pitch);
      }
    }, delay);

    return () => clearTimeout(timer);
  }, [activeDialogue, dialogueIndex, visibleText, textSpeed, audioSettings.soundEnabled]);

  // Trigger dialogue when entering zones
  useEffect(() => {
    if (!snapshot) return;

    if (prevZoneIdRef.current === null) {
      prevZoneIdRef.current = snapshot.zoneId;
      triggerDialogue([
        {
          speaker: "Narrator",
          text: "Welcome to the test fields of NyWarudo.",
          pitch: 1.0,
        },
        {
          speaker: "Old Sage",
          text: "Watch your steps, traveler. Each movement consumes your vital Energy.",
          pitch: 0.7,
        },
      ]);
      return;
    }

    if (prevZoneIdRef.current !== snapshot.zoneId) {
      prevZoneIdRef.current = snapshot.zoneId;
      if (snapshot.zoneId === "test_zone_2") {
        triggerDialogue([
          {
            speaker: "Narrator",
            text: "The air here grows heavy and cold.",
            pitch: 0.9,
          },
          {
            speaker: "Mysterious Voice",
            text: "Who dares trespass in the Eastern Ruins?",
            pitch: 1.4,
          },
        ]);
      } else if (snapshot.zoneId === "test_zone") {
        triggerDialogue([
          {
            speaker: "Narrator",
            text: "You returned to the relative safety of the starting fields.",
            pitch: 1.0,
          },
        ]);
      }
    }
  }, [snapshot?.zoneId, triggerDialogue]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const keyLower = event.key.toLowerCase();

      // Block all control commands if a dialogue is active
      if (activeDialogue) {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          progressDialogue();
        } else if (event.key === "Escape") {
          event.preventDefault();
          setActiveDialogue(null);
        }
        return;
      }

      if (keyLower === "c") {
        event.preventDefault();
        setIsCharacterSheetOpen((prev) => !prev);
        return;
      }

      if (event.key === "Escape") {
        event.preventDefault();
        if (isCharacterSheetOpen) {
          setIsCharacterSheetOpen(false);
        } else {
          onBackToTitle();
        }
        return;
      }

      if (isCharacterSheetOpen) {
        return; // Ignore moves and rests while character sheet is open
      }

      if (keyLower === "r") {
        event.preventDefault();
        executeCommand({ type: "Rest" });
        return;
      }

      const commandType = getGameCommandForKey(event.key, keyboardLayout);

      if (commandType) {
        event.preventDefault();
        executeCommand({ type: commandType });
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    executeCommand,
    onBackToTitle,
    keyboardLayout,
    isCharacterSheetOpen,
    activeDialogue,
    progressDialogue,
  ]);

  if (!snapshot) {
    return (
      <main className="app-shell">
        <TerminalPanel>
          <p>Loading...</p>
        </TerminalPanel>
      </main>
    );
  }

  const gridRenderSnapshot = createGridRenderSnapshot(snapshot);

  return (
    <main className="app-shell" aria-labelledby="game-heading">
      <div className="game-layout">
        {/* Left Panel: Player Stats */}
        <TerminalPanel className="game-layout__sidebar-left">
          <p className="terminal-kicker">CHARACTER</p>
          <h2 className="terminal-heading-sm">Status</h2>

          <div className="sidebar-stats">
            <div className="sidebar-stats__section">
              <p className="sidebar-stats__label">Energy</p>
              <div className="energy-bar-container">
                <div
                  className="energy-bar-fill"
                  style={{ width: `${snapshot.stats.energy}%` }}
                />
                <span className="energy-bar-text">
                  {snapshot.stats.energy} / {snapshot.stats.maxEnergy}
                </span>
              </div>
            </div>

            <div className="sidebar-stats__section">
              <p className="sidebar-stats__label">Wealth</p>
              <p className="sidebar-stats__value">
                {formatCurrency(snapshot.stats.currency)}
              </p>
            </div>

            <div className="sidebar-stats__section">
              <p className="sidebar-stats__label">Standing</p>
              <p className="sidebar-stats__value">
                {snapshot.stats.academicTitle}
              </p>
            </div>
          </div>

          <div className="sidebar-actions">
            <TerminalButton onClick={() => setIsCharacterSheetOpen(true)}>
              [C] Sheet
            </TerminalButton>
            <TerminalButton
              onClick={() => executeCommand({ type: "Rest" })}
              disabled={snapshot.stats.energy >= snapshot.stats.maxEnergy}
            >
              [R] Rest
            </TerminalButton>
          </div>
        </TerminalPanel>

        {/* Center Panel: Map Canvas */}
        <TerminalPanel
          className="game-layout__center"
          style={{ position: "relative" }}
        >
          <p className="terminal-kicker">SESSION ACTIVE</p>
          <h1 className="terminal-heading-md" id="game-heading">
            {snapshot.zoneName}
          </h1>

          <GameCanvas
            ariaLabel="Zone grid"
            className="game-screen__canvas"
            renderSnapshot={gridRenderSnapshot}
          />

          <div className="game-screen__debug">
            <p>
              Position: ({snapshot.playerX}, {snapshot.playerY})
            </p>
            <p>Tick: {snapshot.tick}</p>
            <p>Zone: {snapshot.zoneId}</p>
          </div>

          <div className="game-screen__controls" role="group" aria-label="Movement controls">
            <div />
            <TerminalButton onClick={() => executeCommand({ type: "MoveNorth" })}>
              &uarr; North [{getMovementKeyLabel("MoveNorth", keyboardLayout)}]
            </TerminalButton>
            <div />
            <TerminalButton onClick={() => executeCommand({ type: "MoveWest" })}>
              &larr; West [{getMovementKeyLabel("MoveWest", keyboardLayout)}]
            </TerminalButton>
            <TerminalButton onClick={() => executeCommand({ type: "MoveSouth" })}>
              &darr; South [{getMovementKeyLabel("MoveSouth", keyboardLayout)}]
            </TerminalButton>
            <TerminalButton onClick={() => executeCommand({ type: "MoveEast" })}>
              &rarr; East [{getMovementKeyLabel("MoveEast", keyboardLayout)}]
            </TerminalButton>
          </div>

          {/* Dialogue Box overlay */}
          {activeDialogue && activeDialogue[dialogueIndex] && (
            <div className="dialogue-box" onClick={progressDialogue}>
              <div className="dialogue-box__header">
                <span className="dialogue-box__speaker">
                  {activeDialogue[dialogueIndex].speaker}
                </span>
              </div>
              <div className="dialogue-box__body">
                <p className="dialogue-box__text">{visibleText}</p>
              </div>
              <div className="dialogue-box__footer">
                <span className="dialogue-box__prompt">
                  {isTyping ? "..." : "Press Enter or Click to Continue"}
                </span>
              </div>
            </div>
          )}
        </TerminalPanel>

        {/* Right Panel: Action Log */}
        <TerminalPanel className="game-layout__sidebar-right">
          <p className="terminal-kicker">CHRONICLE</p>
          <h2 className="terminal-heading-sm">Action Log</h2>

          <div
            className="game-screen__log"
            ref={logRef}
            role="log"
            aria-label="Game log"
          >
            {snapshot.log.map((entry, i) => (
              <p key={i} className="game-screen__log-entry">
                <span className="game-screen__log-tick">[{entry.tick}]</span>{" "}
                {entry.message}
              </p>
            ))}
          </div>
        </TerminalPanel>

        {/* Modal Overlay: Detailed Character Sheet */}
        {isCharacterSheetOpen && (
          <div
            className="modal-overlay"
            onClick={() => setIsCharacterSheetOpen(false)}
          >
            <TerminalPanel
              className="stats-modal"
              onClick={(e) => e.stopPropagation()}
            >
              <p className="terminal-kicker">CHARACTER PROFILE</p>
              <h2 className="terminal-heading-md">Character Sheet</h2>

              <div className="stats-modal__content">
                <div className="stats-modal__section">
                  <h3 className="stats-modal__subtitle">Attributes</h3>
                  <div className="stats-modal__grid">
                    {Object.entries(snapshot.stats.attributes).map(
                      ([key, val]) => (
                        <div key={key} className="stats-modal__row">
                          <span className="stats-modal__attr-name">
                            {capitalize(key)}
                          </span>
                          <span className="stats-modal__attr-value">{val}</span>
                        </div>
                      ),
                    )}
                  </div>
                </div>

                <div className="stats-modal__section">
                  <h3 className="stats-modal__subtitle">Academy Status</h3>
                  <div className="stats-modal__academic">
                    <p>
                      <strong>Title:</strong> {snapshot.stats.academicTitle}
                    </p>
                    <p>
                      <strong>Studies Progress:</strong>{" "}
                      {snapshot.stats.academicProgress}%
                    </p>
                  </div>
                </div>
              </div>

              <div className="stats-modal__actions">
                <TerminalButton onClick={() => setIsCharacterSheetOpen(false)}>
                  Close [Esc]
                </TerminalButton>
              </div>
            </TerminalPanel>
          </div>
        )}
      </div>
    </main>
  );
}
