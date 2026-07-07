import type { Stats } from "../../../engine";

type OverviewTabProps = {
  stats: Stats;
};

export function OverviewTab({ stats }: OverviewTabProps) {
  return (
    <div className="stats-modal__tab-content">
      <div className="stats-modal__section stats-modal__section--resources">
        <h3 className="stats-modal__subtitle">Resources</h3>
        <div className="stats-modal__grid">
          <StatsRow
            label="HP"
            value={`${stats.resources.hp} / ${stats.resources.maxHp}`}
          />
          <StatsRow
            label="MP"
            value={`${stats.resources.mp} / ${stats.resources.maxMp}`}
          />
          <StatsRow
            label="SP"
            value={`${stats.resources.sp} / ${stats.resources.maxSp}`}
          />
          <StatsRow
            label="Energy"
            value={`${stats.resources.energy} / ${stats.resources.maxEnergy}`}
          />
        </div>
      </div>

      <div className="stats-modal__section stats-modal__section--combat">
        <h3 className="stats-modal__subtitle">Combat</h3>
        <div className="stats-modal__grid">
          {Object.entries(stats.combat).map(([key, val]) => (
            <StatsRow key={key} label={formatStatLabel(key)} value={val} />
          ))}
        </div>
      </div>
    </div>
  );
}

function StatsRow({
  label,
  value,
}: {
  label: string;
  value: number | string;
}) {
  return (
    <div className="stats-modal__row">
      <span className="stats-modal__attr-name">{label}</span>
      <span className="stats-modal__attr-value">{value}</span>
    </div>
  );
}

function formatStatLabel(key: string): string {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (firstLetter) => firstLetter.toUpperCase());
}
