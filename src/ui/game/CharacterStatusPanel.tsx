import type { Stats } from "../../engine/components";
import type { WorldTimeSnapshot } from "../../engine";
import { TerminalButton } from "../components/TerminalButton";
import { TerminalPanel } from "../components/TerminalPanel";
import { formatCurrency } from "../controls/statsFormatter";
import { WorldClock } from "./WorldClock";

type CharacterStatusPanelProps = {
  controlsDisabled?: boolean;
  onOpenInventory: () => void;
  onOpenSheet: () => void;
  onOpenJournal: () => void;
  onRest: () => void;
  stats: Stats;
  worldTime: WorldTimeSnapshot;
};

export function CharacterStatusPanel({
  controlsDisabled = false,
  onOpenInventory,
  onOpenSheet,
  onOpenJournal,
  onRest,
  stats,
  worldTime,
}: CharacterStatusPanelProps) {
  return (
    <TerminalPanel className="game-layout__sidebar-left">
      <p className="terminal-kicker">CHARACTER</p>
      <h2 className="terminal-heading-sm">Status</h2>

      <WorldClock worldTime={worldTime} />

      <div className="sidebar-stats">
        <div className="sidebar-stats__section">
          <p className="sidebar-stats__label">Energy</p>
          <div className="energy-bar-container">
            <div
              className="energy-bar-fill"
              style={{ width: `${stats.energy}%` }}
            />
            <span className="energy-bar-text">
              {stats.energy} / {stats.maxEnergy}
            </span>
          </div>
        </div>

        <div className="sidebar-stats__section">
          <p className="sidebar-stats__label">Wealth</p>
          <p className="sidebar-stats__value">
            {formatCurrency(stats.currency)}
          </p>
        </div>

        <div className="sidebar-stats__section">
          <p className="sidebar-stats__label">Standing</p>
          <p className="sidebar-stats__value">{stats.academicTitle}</p>
        </div>
      </div>

      <div className="sidebar-actions">
        <TerminalButton disabled={controlsDisabled} onClick={onOpenSheet}>
          [C] Sheet
        </TerminalButton>
        <TerminalButton disabled={controlsDisabled} onClick={onOpenInventory}>
          [I] Inventory
        </TerminalButton>
        <TerminalButton disabled={controlsDisabled} onClick={onOpenJournal}>
          [J] Journal
        </TerminalButton>
        <TerminalButton
          disabled={controlsDisabled || stats.energy >= stats.maxEnergy}
          onClick={onRest}
        >
          [R] Rest
        </TerminalButton>
      </div>
    </TerminalPanel>
  );
}
