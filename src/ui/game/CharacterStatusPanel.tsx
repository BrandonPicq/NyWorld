import type { Stats, LayeredStatBreakdown, WorldTimeSnapshot } from "../../engine";
import { getClassDef } from "../../engine/classes/classRegistry";
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
  statLayers: LayeredStatBreakdown;
  worldTime: WorldTimeSnapshot;
  keyboardLayout: KeyboardLayout;
  isCombatActive?: boolean;
};

export function CharacterStatusPanel({
  controlsDisabled = false,
  isCombatActive = false,
  onOpenInventory,
  onOpenSheet,
  onOpenJournal,
  onRest,
  onStudy,
  stats,
  statLayers,
  worldTime,
  keyboardLayout,
}: CharacterStatusPanelProps) {
  const { energy, maxEnergy } = stats.resources;
  const className = getClassDef(statLayers.classId).name;

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
          <p className="sidebar-stats__label">Global Lv. {statLayers.globalLevel}</p>
          <div className="xp-bar-container">
            <div
              className="xp-bar-fill xp-bar-fill--global"
              style={{ width: `${(statLayers.globalXp / statLayers.globalXpToNext) * 100}%` }}
            />
            <span className="xp-bar-text">
              {statLayers.globalXp} / {statLayers.globalXpToNext}
            </span>
          </div>
        </div>

        <div className="sidebar-stats__section">
          <p className="sidebar-stats__label">{className} Lv. {statLayers.classLevel}</p>
          <div className="xp-bar-container">
            <div
              className="xp-bar-fill xp-bar-fill--class"
              style={{ width: `${(statLayers.classXp / statLayers.classXpToNext) * 100}%` }}
            />
            <span className="xp-bar-text">
              {statLayers.classXp} / {statLayers.classXpToNext}
            </span>
          </div>
        </div>
      </div>

      {isCombatActive ? (
        <CombatSidebarStats stats={stats} />
      ) : (
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
      )}
    </TerminalPanel>
  );
}

function CombatSidebarStats({ stats }: { stats: Stats }) {
  return (
    <div className="sidebar-combat">
      <p className="sidebar-actions__label">Combat</p>

      <div className="sidebar-combat__resources">
        <SidebarCombatResource
          label="MP"
          tone="mp"
          value={stats.resources.mp}
          max={stats.resources.maxMp}
        />
        <SidebarCombatResource
          label="SP"
          tone="sp"
          value={stats.resources.sp}
          max={stats.resources.maxSp}
        />
      </div>

      <div className="sidebar-combat__stats-grid" aria-label="Player combat stats">
        <SidebarCombatStat label="ATK" value={stats.combat.attack} />
        <SidebarCombatStat label="MAG" value={stats.combat.magicAttack} />
        <SidebarCombatStat label="DEF" value={stats.combat.defense} />
        <SidebarCombatStat label="MDF" value={stats.combat.magicDefense} />
        <SidebarCombatStat label="AGI" value={stats.attributes.agility} />
        <SidebarCombatStat label="SPI" value={stats.attributes.spirit} />
      </div>
    </div>
  );
}

function SidebarCombatResource({
  label,
  max,
  tone,
  value,
}: {
  label: string;
  max: number;
  tone: "mp" | "sp";
  value: number;
}) {
  const width = max > 0 ? (value / max) * 100 : 0;

  return (
    <div className="sidebar-combat__resource-row">
      <span className="sidebar-combat__resource-label">{label}</span>
      <div className="combat-bar-container">
        <div
          className={`combat-bar-fill combat-bar-fill--${tone}`}
          style={{ width: `${width}%` }}
        />
        <span className="combat-bar-text">
          {value} / {max}
        </span>
      </div>
    </div>
  );
}

function SidebarCombatStat({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="sidebar-combat__stat">
      <span className="sidebar-combat__stat-label">{label}</span>
      <span className="sidebar-combat__stat-value">{value}</span>
    </div>
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
