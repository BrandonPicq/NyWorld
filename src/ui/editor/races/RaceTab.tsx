import { useState } from "react";
import {
  CORE_ATTRIBUTE_OPTIONS,
  formatContentDiagnostic,
  type RaceDef,
} from "../../../engine";
import { IdentifierLabel } from "../../components/IdentifierLabel";
import { ScrollRegion } from "../../components/ScrollRegion";
import { TerminalButton } from "../../components/TerminalButton";
import { TerminalPanel } from "../../components/TerminalPanel";
import type { EditorContentNavigationTarget } from "../DiagnosticList";
import { ListFilterField } from "../ListFilterField";
import { filterByIdOrName } from "../listFilter";
import { ReferenceList } from "../ReferenceList";
import type { RaceDraftController } from "./useRaceDraft";

type RaceTabProps = {
  draft: RaceDraftController;
  onNavigate: (target: EditorContentNavigationTarget) => void;
};

export function RaceTab({ draft, onNavigate }: RaceTabProps) {
  const [listFilter, setListFilter] = useState("");
  const filteredRaces = filterByIdOrName(
    draft.races.map((race) => ({
      ...race,
      id: race.raceId,
      name: race.name,
    })),
    listFilter,
  );

  return (
    <>
      <section className="editor-summary" aria-label="Race summary">
        <span>{draft.races.length} races</span>
        <span>{draft.errorCount} errors</span>
        <span>{draft.warningCount} warnings</span>
        <span>{draft.hasUnsavedChanges ? "unsaved" : "saved"}</span>
      </section>

      <div className="workbench">
        <ScrollRegion className="workbench__rail">
          <TerminalPanel className="editor-panel">
            <h2 className="editor-panel__title">Races</h2>
            <ListFilterField
              label="Filter"
              onChange={setListFilter}
              value={listFilter}
            />
            <div className="editor-entry-list">
              {filteredRaces.length === 0 ? (
                <p className="editor-empty">No matching races.</p>
              ) : null}
              {filteredRaces.map((race) => (
                <TerminalButton
                  className="editor-entry-button"
                  isSelected={race.raceId === draft.selectedRaceId}
                  key={race.raceId}
                  onClick={() => draft.selectRace(race.raceId)}
                >
                  <span className="editor-zone-entry">
                    <span className="editor-zone-entry__name">
                      <IdentifierLabel value={race.raceId} />
                      {race.hasUnsavedChanges ? " *" : ""}
                    </span>
                    <span className="editor-zone-entry__meta">{race.name}</span>
                  </span>
                </TerminalButton>
              ))}
            </div>
          </TerminalPanel>
        </ScrollRegion>

        <ScrollRegion className="workbench__main">
          <TerminalPanel className="editor-panel">
            <h2 className="editor-panel__title">Race Sheet</h2>
            {draft.selectedRace ? (
              <RaceSheetForm draft={draft} race={draft.selectedRace} />
            ) : (
              <p className="editor-empty">No race selected.</p>
            )}
          </TerminalPanel>
        </ScrollRegion>

        <ScrollRegion className="workbench__inspector">
          <TerminalPanel className="editor-panel">
            <h2 className="editor-panel__title">Problems</h2>
            {draft.selectedRaceDiagnostics.length === 0 ? (
              <p className="editor-empty">No problems.</p>
            ) : (
              <ul className="editor-diagnostic-list">
                {draft.selectedRaceDiagnostics.map((diagnostic, index) => (
                  <li
                    className={`editor-diagnostic editor-diagnostic--${diagnostic.severity}`}
                    key={`${diagnostic.contentId ?? "race"}-${diagnostic.path}-${index}`}
                  >
                    {formatContentDiagnostic(diagnostic)}
                  </li>
                ))}
              </ul>
            )}

            <ReferenceList
              emptyLabel="No incoming references."
              onNavigate={onNavigate}
              references={draft.selectedRaceReferences}
              title="Incoming References"
              useTarget={false}
            />
          </TerminalPanel>
        </ScrollRegion>
      </div>
    </>
  );
}

function RaceSheetForm({
  draft,
  race,
}: {
  draft: RaceDraftController;
  race: RaceDef;
}) {
  return (
    <section className="editor-item-form" aria-label="Race sheet editor">
      <div className="editor-family__header">
        <h3>{race.name || race.raceId}</h3>
        <span>{draft.selectedRaceHasUnsavedChanges ? "dirty" : "clean"}</span>
      </div>

      <label className="editor-field">
        <span>Race Id</span>
        <input disabled readOnly type="text" value={race.raceId} />
      </label>

      <label className="editor-field">
        <span>Name</span>
        <input
          disabled={draft.isSaving}
          onChange={(event) =>
            draft.updateSelectedRace((current) => ({
              ...current,
              name: event.target.value,
            }))
          }
          type="text"
          value={race.name}
        />
      </label>

      <label className="editor-field">
        <span>Description</span>
        <textarea
          disabled={draft.isSaving}
          onChange={(event) =>
            draft.updateSelectedRace((current) => ({
              ...current,
              description: event.target.value,
            }))
          }
          rows={4}
          value={race.description}
        />
      </label>

      <section className="editor-zone-section">
        <h3>Growth Multipliers</h3>
        <div className="editor-stat-grid">
          {CORE_ATTRIBUTE_OPTIONS.map((attribute) => (
            <label className="editor-field" key={attribute}>
              <span>{attribute}</span>
              <input
                disabled={draft.isSaving}
                min={0.1}
                onChange={(event) =>
                  draft.updateSelectedRace((current) => ({
                    ...current,
                    growthMultipliers: {
                      ...current.growthMultipliers,
                      [attribute]: Number(event.target.value),
                    },
                  }))
                }
                step={0.05}
                type="number"
                value={race.growthMultipliers[attribute] ?? 1}
              />
            </label>
          ))}
        </div>
      </section>

      <div className="editor-actions">
        <TerminalButton
          className="editor-action-button"
          disabled={!draft.canSaveSelectedRace}
          onClick={draft.saveSelectedRace}
        >
          Save Race
        </TerminalButton>
        <TerminalButton
          className="editor-action-button"
          disabled={!draft.selectedRaceHasUnsavedChanges || draft.isSaving}
          onClick={draft.resetSelectedRace}
        >
          Reset
        </TerminalButton>
      </div>

      <p
        aria-live="polite"
        className={`editor-save-status editor-save-status--${draft.saveStatus.state}`}
      >
        {draft.saveStatus.message}
      </p>
    </section>
  );
}
