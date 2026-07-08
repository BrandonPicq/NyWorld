import {
  getAllQtePatternDefs,
  getCommandMasteryDef,
  type KnownPatternMap,
  type Stats,
  type LayeredStatBreakdown,
  type PatternDef,
} from "../../../engine";

type MasteryTabProps = {
  knownPatterns: KnownPatternMap;
  stats: Stats;
  statLayers: LayeredStatBreakdown;
};

export function MasteryTab({ knownPatterns, stats, statLayers }: MasteryTabProps) {
  const knownPatternDefs = getAllQtePatternDefs()
    .filter((pattern) => knownPatterns[pattern.patternId])
    .sort((a, b) => a.name.localeCompare(b.name));

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

      <div className="stats-modal__section stats-modal__section--techniques">
        <h3 className="stats-modal__subtitle">Techniques</h3>
        {knownPatternDefs.length === 0 ? (
          <p className="stats-modal__empty">No techniques learned.</p>
        ) : (
          <div className="stats-modal__technique-list">
            {knownPatternDefs.map((pattern) => (
              <TechniqueCard
                key={pattern.patternId}
                knownPatterns={knownPatterns}
                pattern={pattern}
              />
            ))}
          </div>
        )}
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

function TechniqueCard({
  knownPatterns,
  pattern,
}: {
  knownPatterns: KnownPatternMap;
  pattern: PatternDef;
}) {
  return (
    <div className="stats-modal__technique">
      <div className="stats-modal__technique-heading">
        <span>{pattern.name}</span>
        <span>{pattern.kind}</span>
      </div>
      <div className="stats-modal__grid">
        <StatsRow label="Sequence" value={formatPatternInputs(pattern.inputs)} />
        <StatsRow
          label="Uses"
          value={knownPatterns[pattern.patternId]?.timesUsed ?? 0}
        />
        <StatsRow
          label="Evolution"
          value={formatEvolutionProgress(pattern, knownPatterns)}
        />
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

function formatPatternInputs(inputs: readonly string[]): string {
  return inputs.map(formatStatLabel).join(" -> ");
}

function formatEvolutionProgress(
  pattern: PatternDef,
  knownPatterns: KnownPatternMap,
): string {
  const evolutions = getAllQtePatternDefs()
    .filter((candidate) => candidate.evolvesFrom?.patternId === pattern.patternId)
    .sort((a, b) => a.name.localeCompare(b.name));

  if (evolutions.length === 0) {
    return "None";
  }

  return evolutions
    .map((evolution) => {
      if (knownPatterns[evolution.patternId]) {
        return `${evolution.name} learned`;
      }
      const usageRequired = evolution.evolvesFrom?.usageRequired ?? 0;
      const uses = Math.min(
        knownPatterns[pattern.patternId]?.timesUsed ?? 0,
        usageRequired,
      );
      return `${evolution.name}: ${uses} / ${usageRequired} uses, level ${evolution.requiredPlayerLevel}`;
    })
    .join("; ");
}
