import {
  getCommandMasteryDef,
  type Stats,
  type LayeredStatBreakdown,
} from "../../../engine";

type MasteryTabProps = {
  stats: Stats;
  statLayers: LayeredStatBreakdown;
};

export function MasteryTab({ stats, statLayers }: MasteryTabProps) {
  return (
    <div className="stats-modal__tab-content">
      <div className="stats-modal__section stats-modal__section--mastery">
        <h3 className="stats-modal__subtitle">Command Mastery</h3>
        <div className="stats-modal__grid">
          {Object.entries(statLayers.masteries).map(([cmdId, state]) => {
            const def = getCommandMasteryDef(cmdId);
            return (
              <StatsRow
                key={cmdId}
                label={def.name}
                value={`Lv. ${state.level} / ${def.cap} (Uses: ${state.usage} / ${
                  state.level >= def.cap ? "-" : def.usageRequired
                })`}
              />
            );
          })}
        </div>
      </div>

      <div className="stats-modal__section stats-modal__section--skills">
        <h3 className="stats-modal__subtitle">Skills</h3>
        <div className="stats-modal__grid">
          {Object.entries(stats.skills).map(([key, val]) => (
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
