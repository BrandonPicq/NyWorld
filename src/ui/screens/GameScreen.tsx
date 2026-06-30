import { useCallback, useEffect, useRef, useState } from "react";
import type { GameCommand } from "../../engine/commands";
import { GameplayEngine } from "../../engine/GameplayEngine";
import { loadZone } from "../../engine/zoneLoader";
import type { GameSnapshot } from "../../engine/GameplayEngine";
import testZoneData from "../../content/zones/test_zone.json";
import { TerminalButton } from "../components/TerminalButton";
import { TerminalPanel } from "../components/TerminalPanel";

type GameScreenProps = {
  onBackToTitle: () => void;
};

const KEY_COMMAND: Record<string, GameCommand["type"]> = {
  ArrowUp: "MoveNorth",
  ArrowDown: "MoveSouth",
  ArrowLeft: "MoveWest",
  ArrowRight: "MoveEast",
};

const TILE_GLYPH: Record<number, string> = {
  0: ".",
  1: "#",
};

export function GameScreen({ onBackToTitle }: GameScreenProps) {
  const [snapshot, setSnapshot] = useState<GameSnapshot | null>(null);
  const engineRef = useRef<GameplayEngine | null>(null);

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
    function handleKeyDown(event: KeyboardEvent) {
      const commandType = KEY_COMMAND[event.key];

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
  }, [executeCommand, onBackToTitle]);

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

        <pre className="game-screen__grid" aria-label="Zone grid">
          {renderGrid(snapshot)}
        </pre>

        <div className="game-screen__debug">
          <p>
            Position: ({snapshot.playerX}, {snapshot.playerY})
          </p>
          <p>Tick: {snapshot.tick}</p>
          <p>Zone: {snapshot.zoneId}</p>
        </div>

        <div className="game-screen__controls" role="group" aria-label="Movement controls">
          <TerminalButton onClick={() => executeCommand({ type: "MoveNorth" })}>
            &uarr; North
          </TerminalButton>
          <div className="game-screen__controls-row">
            <TerminalButton onClick={() => executeCommand({ type: "MoveWest" })}>
              &larr; West
            </TerminalButton>
            <TerminalButton onClick={() => executeCommand({ type: "MoveSouth" })}>
              &darr; South
            </TerminalButton>
            <TerminalButton onClick={() => executeCommand({ type: "MoveEast" })}>
              &rarr; East
            </TerminalButton>
          </div>
        </div>

        <div className="game-screen__log" role="log" aria-label="Game log">
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

function renderGrid(snapshot: GameSnapshot): string {
  const rows: string[] = [];

  for (let y = 0; y < snapshot.mapHeight; y++) {
    let row = "";

    for (let x = 0; x < snapshot.mapWidth; x++) {
      if (x === snapshot.playerX && y === snapshot.playerY) {
        row += "@";
      } else {
        row += TILE_GLYPH[snapshot.tiles[y][x]] ?? "?";
      }
    }

    rows.push(row);
  }

  return rows.join("\n");
}
