import type { Stats } from "../../engine/components";
import { TerminalButton } from "../components/TerminalButton";
import { TerminalPanel } from "../components/TerminalPanel";
import { formatCurrency } from "../controls/statsFormatter";

type CharacterStatusPanelProps = {
  onOpenSheet: () => void;
  onRest: () => void;
  stats: Stats;
};

export function CharacterStatusPanel({
  onOpenSheet,
  onRest,
  stats,
}: CharacterStatusPanelProps) {
  return (
    <TerminalPanel className="game-layout__sidebar-left">
      <p className="terminal-kicker">CHARACTER</p>
      <h2 className="terminal-heading-sm">Status</h2>

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
        <TerminalButton onClick={onOpenSheet}>[C] Sheet</TerminalButton>
        <TerminalButton onClick={onRest} disabled={stats.energy >= stats.maxEnergy}>
          [R] Rest
        </TerminalButton>
      </div>
    </TerminalPanel>
  );
}
