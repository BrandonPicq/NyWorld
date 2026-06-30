import { useCallback, useEffect, useRef, useState } from "react";
import type { GameCommand } from "../../engine/commands";
import { GameplayEngine } from "../../engine/GameplayEngine";
import { loadZone } from "../../engine/zoneLoader";
import type { GameSnapshot } from "../../engine/GameplayEngine";
import testZoneData from "../../content/zones/test_zone.json";
import { GameCanvas } from "../components/GameCanvas";
import { TerminalButton } from "../components/TerminalButton";
import { TerminalPanel } from "../components/TerminalPanel";

import type { KeyboardLayout } from "../controls/keyboardLayout";

type GameScreenProps = {
  keyboardLayout: KeyboardLayout;
  onBackToTitle: () => void;
};

const getKeyboardCommands = (layout: KeyboardLayout): Record<string, GameCommand["type"]> => {
  const common = {
    ArrowUp: "MoveNorth",
    ArrowDown: "MoveSouth",
    ArrowLeft: "MoveWest",
    ArrowRight: "MoveEast",
    s: "MoveSouth",
    S: "MoveSouth",
    d: "MoveEast",
    D: "MoveEast",
  } as const;

  if (layout === "azerty") {
    return {
      ...common,
      z: "MoveNorth",
      Z: "MoveNorth",
      q: "MoveWest",
      Q: "MoveWest",
    };
  }

  return {
    ...common,
    w: "MoveNorth",
    W: "MoveNorth",
    a: "MoveWest",
    A: "MoveWest",
  };
};

export function GameScreen({ keyboardLayout, onBackToTitle }: GameScreenProps) {
  const [snapshot, setSnapshot] = useState<GameSnapshot | null>(null);
  const engineRef = useRef<GameplayEngine | null>(null);
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const map = loadZone(testZoneData);
    const engine = new GameplayEngine(map);
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

  useEffect(() => {
    const keyCommands = getKeyboardCommands(keyboardLayout);

    function handleKeyDown(event: KeyboardEvent) {
      const commandType = keyCommands[event.key];

      if (commandType) {
        event.preventDefault();
        executeCommand({ type: commandType });
        return;
      }

      if (event.key === "Escape") {
        event.preventDefault();
        onBackToTitle();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [executeCommand, onBackToTitle, keyboardLayout]);

  if (!snapshot) {
    return (
      <main className="app-shell">
        <TerminalPanel>
          <p>Loading...</p>
        </TerminalPanel>
      </main>
    );
  }

  return (
    <main className="app-shell" aria-labelledby="game-heading">
      <TerminalPanel className="game-screen">
        <p className="terminal-kicker">SESSION ACTIVE</p>
        <h1 className="terminal-heading" id="game-heading">
          {snapshot.zoneName}
        </h1>

        <GameCanvas
          ariaLabel="Zone grid"
          className="game-screen__canvas"
          tiles={snapshot.tiles}
          playerX={snapshot.playerX}
          playerY={snapshot.playerY}
          mapWidth={snapshot.mapWidth}
          mapHeight={snapshot.mapHeight}
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
            &uarr; North [{keyboardLayout === "azerty" ? "Z" : "W"}]
          </TerminalButton>
          <div />
          <TerminalButton onClick={() => executeCommand({ type: "MoveWest" })}>
            &larr; West [{keyboardLayout === "azerty" ? "Q" : "A"}]
          </TerminalButton>
          <TerminalButton onClick={() => executeCommand({ type: "MoveSouth" })}>
            &darr; South [S]
          </TerminalButton>
          <TerminalButton onClick={() => executeCommand({ type: "MoveEast" })}>
            &rarr; East [D]
          </TerminalButton>
        </div>

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
    </main>
  );
}
