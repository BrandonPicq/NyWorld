import type { Stats } from "../../engine/components";
import type { WorldTimeSnapshot } from "../../engine";
import { TerminalButton } from "../components/TerminalButton";
import { TerminalPanel } from "../components/TerminalPanel";
import { formatCurrency } from "../controls/statsFormatter";
import { WorldClock } from "./WorldClock";
import type { KeyboardLayout } from "../controls/keyboardLayout";

type SidebarActionButtonProps = {
  disabled?: boolean;
  keyLabel: string;
  label: string;
  onClick: () => void;
};

type CharacterStatusPanelProps = {
  controlsDisabled?: boolean;
  onOpenInventory: () => void;
  onOpenSheet: () => void;
  onOpenJournal: () => void;
  onRest: () => void;
  onStudy: () => void;
  stats: Stats;
  worldTime: WorldTimeSnapshot;
  keyboardLayout: KeyboardLayout;
};

export function CharacterStatusPanel({
  controlsDisabled = false,
  onOpenInventory,
  onOpenSheet,
  onOpenJournal,
  onRest,
  onStudy,
  stats,
  worldTime,
  keyboardLayout,
}: CharacterStatusPanelProps) {
  const { energy, maxEnergy } = stats.resources;

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
              style={{ width: `${(energy / maxEnergy) * 100}%` }}
            />
            <span className="energy-bar-text">
              {energy} / {maxEnergy}
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
          <p className="sidebar-stats__value">
            {stats.progression.academicTitle}
          </p>
        </div>
      </div>

      <div className="sidebar-actions">
        <div className="sidebar-actions__group">
          <p className="sidebar-actions__label">Menus</p>
          <SidebarActionButton
            disabled={controlsDisabled}
            keyLabel="C"
            label="Sheet"
            onClick={onOpenSheet}
          />
          <SidebarActionButton
            disabled={controlsDisabled}
            keyLabel="I"
            label="Inventory"
            onClick={onOpenInventory}
          />
          <SidebarActionButton
            disabled={controlsDisabled}
            keyLabel={keyboardLayout === "azerty" ? "A" : "Q"}
            label="Journal"
            onClick={onOpenJournal}
          />
        </div>

        <div className="sidebar-actions__group sidebar-actions__group--compact">
          <p className="sidebar-actions__label">Actions</p>
          <SidebarActionButton
            disabled={controlsDisabled || energy <= 0}
            keyLabel="T"
            label="Study"
            onClick={onStudy}
          />
          <SidebarActionButton
            disabled={controlsDisabled || energy >= maxEnergy}
            keyLabel="R"
            label="Rest"
            onClick={onRest}
          />
        </div>
      </div>
    </TerminalPanel>
  );
}

function SidebarActionButton({
  disabled,
  keyLabel,
  label,
  onClick,
}: SidebarActionButtonProps) {
  return (
    <TerminalButton
      aria-keyshortcuts={keyLabel.toLowerCase()}
      aria-label={`${label} (${keyLabel})`}
      className="sidebar-actions__button"
      disabled={disabled}
      onClick={onClick}
    >
      <span className="sidebar-actions__button-label">{label}</span>
      <span className="sidebar-actions__keycap">{keyLabel}</span>
    </TerminalButton>
  );
}
