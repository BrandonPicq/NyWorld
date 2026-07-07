import type { Stats, LayeredStatBreakdown, CoreAttributeKey } from "../../../engine";
import { TerminalButton } from "../../components/TerminalButton";

type AttributesTabProps = {
  stats: Stats;
  statLayers: LayeredStatBreakdown;
  onChooseAttribute: (attribute: CoreAttributeKey) => void;
};

export function AttributesTab({
  stats,
  statLayers,
  onChooseAttribute,
}: AttributesTabProps) {
  return (
    <div className="stats-modal__tab-content">
      <div className="stats-modal__section stats-modal__section--attributes">
        <h3 className="stats-modal__subtitle">Attributes</h3>
        <div className="stats-modal__grid">
          {Object.entries(stats.attributes).map(([key, val]) => (
            <StatsRow key={key} label={formatStatLabel(key)} value={val} />
          ))}
        </div>
      </div>

      <div className="stats-modal__section stats-modal__section--layers">
        <h3 className="stats-modal__subtitle">Growth Layers</h3>
        <div className="stats-modal__academic">
          <p>
            <strong>Class:</strong>{" "}
            {statLayers.classId.charAt(0).toUpperCase() + statLayers.classId.slice(1)}{" "}
            Lv. {statLayers.classLevel}
          </p>
          <p>
            <strong>Race:</strong>{" "}
            {statLayers.raceId.charAt(0).toUpperCase() + statLayers.raceId.slice(1)}
          </p>
          <p>
            <strong>Global Level:</strong> {statLayers.globalLevel}
          </p>
          <p>
            <strong>Global XP:</strong> {statLayers.globalXp} /{" "}
            {statLayers.globalXpToNext}
          </p>
          <p>
            <strong>Class XP:</strong> {statLayers.classXp} /{" "}
            {statLayers.classXpToNext}
          </p>
          <p>
            <strong>Attribute Choices:</strong> {statLayers.pendingAttributeChoices}
          </p>
        </div>

        {statLayers.pendingAttributeChoices > 0 && (
          <div className="stats-modal__choice-grid">
            {Object.keys(stats.attributes).map((attribute) => (
              <TerminalButton
                className="stats-modal__choice-action"
                key={attribute}
                onClick={() => onChooseAttribute(attribute as CoreAttributeKey)}
              >
                + {formatStatLabel(attribute)}
              </TerminalButton>
            ))}
          </div>
        )}

        <div className="stats-modal__layer-grid">
          <span>Attribute</span>
          <span>Base</span>
          <span>Global</span>
          <span>Class</span>
          <span>Equip</span>
          {Object.entries(statLayers.effectiveAttributes).map(([key]) => (
            <StatsLayerRow
              classValue={
                statLayers.classAttributes[
                  key as keyof typeof statLayers.classAttributes
                ]
              }
              equipmentValue={
                statLayers.equipmentAttributes[
                  key as keyof typeof statLayers.equipmentAttributes
                ]
              }
              globalValue={
                statLayers.globalAttributes[
                  key as keyof typeof statLayers.globalAttributes
                ]
              }
              key={key}
              label={formatStatLabel(key)}
              baseValue={
                statLayers.baseAttributes[
                  key as keyof typeof statLayers.baseAttributes
                ]
              }
            />
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

function StatsLayerRow({
  label,
  baseValue,
  globalValue,
  classValue,
  equipmentValue,
}: {
  label: string;
  baseValue: number;
  globalValue: number;
  classValue: number;
  equipmentValue: number;
}) {
  return (
    <>
      <span className="stats-modal__attr-name">{label}</span>
      <span className="stats-modal__attr-value">{baseValue}</span>
      <span className="stats-modal__attr-value">
        {formatSigned(globalValue)}
      </span>
      <span className="stats-modal__attr-value">{formatSigned(classValue)}</span>
      <span className="stats-modal__attr-value">
        {formatSigned(equipmentValue)}
      </span>
    </>
  );
}

function formatSigned(value: number): string {
  return value > 0 ? `+${value}` : String(value);
}

function formatStatLabel(key: string): string {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (firstLetter) => firstLetter.toUpperCase());
}
