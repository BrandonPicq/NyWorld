import type { ReactNode } from "react";
import type { GameCommand, GameSnapshot } from "../../engine";
import type { GridRenderSnapshot } from "../../rendering";
import { GameCanvas } from "../components/GameCanvas";
import { TerminalButton } from "../components/TerminalButton";
import { TerminalPanel } from "../components/TerminalPanel";
import { getMovementKeyLabel } from "../controls/gameInput";
import type { KeyboardLayout } from "../controls/keyboardLayout";

type GameCenterPanelProps = {
  children?: ReactNode;
  keyboardLayout: KeyboardLayout;
  onExecuteCommand: (command: GameCommand) => void;
  renderSnapshot: GridRenderSnapshot;
  snapshot: GameSnapshot;
};

export function GameCenterPanel({
  children,
  keyboardLayout,
  onExecuteCommand,
  renderSnapshot,
  snapshot,
}: GameCenterPanelProps) {
  return (
    <TerminalPanel className="game-layout__center game-layout__center--overlay">
      <p className="terminal-kicker">SESSION ACTIVE</p>
      <h1 className="terminal-heading-md" id="game-heading">
        {snapshot.zoneName}
      </h1>

      <GameCanvas
        ariaLabel="Zone grid"
        className="game-screen__canvas"
        renderSnapshot={renderSnapshot}
      />

      <div className="game-screen__debug">
        <p>
          Position: ({snapshot.playerX}, {snapshot.playerY})
        </p>
        <p>Tick: {snapshot.tick}</p>
        <p>Zone: {snapshot.zoneId}</p>
      </div>

      <div
        className="game-screen__controls"
        role="group"
        aria-label="Movement controls"
      >
        <div />
        <TerminalButton onClick={() => onExecuteCommand({ type: "MoveNorth" })}>
          &uarr; North [{getMovementKeyLabel("MoveNorth", keyboardLayout)}]
        </TerminalButton>
        <div />
        <TerminalButton onClick={() => onExecuteCommand({ type: "MoveWest" })}>
          &larr; West [{getMovementKeyLabel("MoveWest", keyboardLayout)}]
        </TerminalButton>
        <TerminalButton onClick={() => onExecuteCommand({ type: "MoveSouth" })}>
          &darr; South [{getMovementKeyLabel("MoveSouth", keyboardLayout)}]
        </TerminalButton>
        <TerminalButton onClick={() => onExecuteCommand({ type: "MoveEast" })}>
          &rarr; East [{getMovementKeyLabel("MoveEast", keyboardLayout)}]
        </TerminalButton>
      </div>

      {children}
    </TerminalPanel>
  );
}
