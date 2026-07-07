import type { Stats } from "../../../engine";

type AcademyTabProps = {
  stats: Stats;
};

export function AcademyTab({ stats }: AcademyTabProps) {
  return (
    <div className="stats-modal__tab-content">
      <div className="stats-modal__section stats-modal__section--academy">
        <h3 className="stats-modal__subtitle">Academy Status</h3>
        <div className="stats-modal__academic">
          <p>
            <strong>Title:</strong> {stats.progression.academicTitle}
          </p>
          <p>
            <strong>Studies Progress:</strong> {stats.progression.academicProgress}%
          </p>
          <p>
            <strong>Conditions:</strong>{" "}
            {stats.conditions.length > 0
              ? stats.conditions.map((c) => c.name).join(", ")
              : "None"}
          </p>
        </div>
      </div>
    </div>
  );
}
