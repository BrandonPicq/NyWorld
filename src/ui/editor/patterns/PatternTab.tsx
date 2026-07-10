import { useState } from "react";
import {
  EQUIPMENT_WEAPON_TYPE_OPTIONS,
  formatContentDiagnostic,
  type EquipmentWeaponType,
  type PatternDef,
} from "../../../engine";
import { IdentifierLabel } from "../../components/IdentifierLabel";
import { ScrollRegion } from "../../components/ScrollRegion";
import { EditorButton } from "../components/EditorButton";
import { EditorPanel } from "../components/EditorPanel";
import type { EditorContentNavigationTarget } from "../DiagnosticList";
import { EditorGroupedList } from "../EditorGroupedList";
import { ReferenceList } from "../ReferenceList";
import type { QtePatternDraftController } from "./useQtePatternDraft";

const PATTERN_KINDS = ["physical", "magical"] as const;
const PATTERN_INPUT_OPTIONS = ["up", "down", "left", "right"] as const;

type PatternTabProps = {
  draft: QtePatternDraftController;
  onNavigate: (target: EditorContentNavigationTarget) => void;
};

export function PatternTab({ draft, onNavigate }: PatternTabProps) {
  const [listFilter, setListFilter] = useState("");
  const [newPatternId, setNewPatternId] = useState("");

  return (
    <>
      <section className="editor-summary" aria-label="Pattern summary">
        <span>{draft.patterns.length} patterns</span>
        <span>{draft.errorCount} errors</span>
        <span>{draft.warningCount} warnings</span>
        <span>{draft.hasUnsavedChanges ? "unsaved" : "saved"}</span>
      </section>

      <div className="workbench">
        <ScrollRegion className="workbench__rail">
          <EditorPanel className="editor-panel">
            <h2 className="editor-panel__title">Patterns</h2>
            <EditorGroupedList
              emptyLabel="No matching patterns."
              filter={listFilter}
              groups={[{
                key: "patterns",
                label: "Patterns",
                entries: draft.patterns.map((pattern) => ({
                  key: pattern.id,
                  id: pattern.id,
                  name: pattern.name,
                  label: <IdentifierLabel value={pattern.id} />,
                  meta: pattern.name,
                  isUnsaved: pattern.hasUnsavedChanges,
                })),
              }]}
              onFilterChange={setListFilter}
              onSelect={(entry) => draft.selectPattern(entry.id)}
              selectedEntryKey={draft.selectedPatternId}
            />

            <div className="editor-form-row">
              <label className="editor-field">
                <span>New pattern id</span>
                <input
                  onChange={(event) => setNewPatternId(event.target.value)}
                  placeholder="lowercase_slug"
                  type="text"
                  value={newPatternId}
                />
              </label>
              <EditorButton
                className="editor-action-button"
                disabled={!draft.canCreatePattern(newPatternId)}
                onClick={() => {
                  draft.createPattern(newPatternId);
                  setNewPatternId("");
                }}
              >
                Create
              </EditorButton>
            </div>
          </EditorPanel>
        </ScrollRegion>

        <ScrollRegion className="workbench__main">
          <EditorPanel className="editor-panel">
            <h2 className="editor-panel__title">Pattern Sheet</h2>
            {draft.selectedPattern ? (
              <PatternForm draft={draft} pattern={draft.selectedPattern} />
            ) : (
              <p className="editor-empty">No pattern selected.</p>
            )}
          </EditorPanel>
        </ScrollRegion>

        <ScrollRegion className="workbench__inspector">
          <EditorPanel className="editor-panel">
            <h2 className="editor-panel__title">Problems</h2>
            {draft.selectedPatternDiagnostics.length === 0 ? (
              <p className="editor-empty">No problems.</p>
            ) : (
              <ul className="editor-diagnostic-list">
                {draft.selectedPatternDiagnostics.map((diagnostic, index) => (
                  <li
                    className={`editor-diagnostic editor-diagnostic--${diagnostic.severity}`}
                    key={`${diagnostic.contentId ?? "pattern"}-${diagnostic.path}-${index}`}
                  >
                    {formatContentDiagnostic(diagnostic)}
                  </li>
                ))}
              </ul>
            )}

            <ReferenceList
              emptyLabel="No incoming references."
              onNavigate={onNavigate}
              references={draft.selectedPatternReferences}
              title="Incoming References"
              useTarget={false}
            />
          </EditorPanel>
        </ScrollRegion>
      </div>
    </>
  );
}

function PatternForm({
  pattern,
  draft,
}: {
  pattern: PatternDef;
  draft: QtePatternDraftController;
}) {
  const evolutionOptions = draft.patternIds.filter(
    (id) => id !== pattern.patternId,
  );

  return (
    <section className="editor-item-form" aria-label="Pattern editor">
      <div className="editor-family__header">
        <h3>{pattern.name || pattern.patternId}</h3>
        <span>
          {draft.selectedPatternHasUnsavedChanges ? "dirty" : "clean"}
        </span>
      </div>

      <label className="editor-field">
        <span>Pattern Id</span>
        <input disabled readOnly type="text" value={pattern.patternId} />
      </label>

      <label className="editor-field">
        <span>Name</span>
        <input
          disabled={draft.isSaving}
          onChange={(event) =>
            draft.updateSelectedPattern((current) => ({
              ...current,
              name: event.target.value,
            }))
          }
          type="text"
          value={pattern.name}
        />
      </label>

      <label className="editor-field">
        <span>Description</span>
        <textarea
          disabled={draft.isSaving}
          onChange={(event) =>
            draft.updateSelectedPattern((current) => ({
              ...current,
              description: event.target.value,
            }))
          }
          rows={3}
          value={pattern.description}
        />
      </label>

      <div className="editor-form-row">
        <label className="editor-field">
          <span>Kind</span>
          <select
            disabled={draft.isSaving}
            onChange={(event) =>
              draft.updateSelectedPattern((current) => ({
                ...current,
                kind: event.target.value as PatternDef["kind"],
              }))
            }
            value={pattern.kind}
          >
            {PATTERN_KINDS.map((kind) => (
              <option key={kind} value={kind}>
                {kind}
              </option>
            ))}
          </select>
        </label>
      </div>

      <section className="editor-zone-section">
        <h3>Inputs</h3>
        <div className="editor-form-row">
          {pattern.inputs.map((input, index) => (
            <label className="editor-field" key={index}>
              <span>#{index + 1}</span>
              <select
                disabled={draft.isSaving}
                onChange={(event) =>
                  draft.updateSelectedPattern((current) => ({
                    ...current,
                    inputs: current.inputs.map((value, i) =>
                      i === index ? event.target.value : value,
                    ),
                  }))
                }
                value={input}
              >
                {PATTERN_INPUT_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
        <div className="editor-actions">
          <EditorButton
            className="editor-action-button"
            disabled={draft.isSaving}
            onClick={() =>
              draft.updateSelectedPattern((current) => ({
                ...current,
                inputs: [...current.inputs, "up"],
              }))
            }
          >
            Add Input
          </EditorButton>
          <EditorButton
            className="editor-action-button"
            disabled={draft.isSaving || pattern.inputs.length === 0}
            onClick={() =>
              draft.updateSelectedPattern((current) => ({
                ...current,
                inputs: current.inputs.slice(0, -1),
              }))
            }
          >
            Remove Last
          </EditorButton>
        </div>
      </section>

      <div className="editor-stat-grid">
        <NumberField
          disabled={draft.isSaving}
          label="Time Limit (ms)"
          onChange={(value) =>
            draft.updateSelectedPattern((current) => ({
              ...current,
              timeLimitMs: value,
            }))
          }
          value={pattern.timeLimitMs}
        />
        <NumberField
          disabled={draft.isSaving}
          label="MP Cost"
          onChange={(value) =>
            draft.updateSelectedPattern((current) => ({
              ...current,
              mpCost: value,
            }))
          }
          value={pattern.mpCost}
        />
        <NumberField
          disabled={draft.isSaving}
          label="Damage Multiplier"
          onChange={(value) =>
            draft.updateSelectedPattern((current) => ({
              ...current,
              damageMultiplier: value,
            }))
          }
          step={0.1}
          value={pattern.damageMultiplier}
        />
        <NumberField
          disabled={draft.isSaving}
          label="Required Level"
          onChange={(value) =>
            draft.updateSelectedPattern((current) => ({
              ...current,
              requiredPlayerLevel: value,
            }))
          }
          value={pattern.requiredPlayerLevel}
        />
        <NumberField
          disabled={draft.isSaving}
          label="Required Intelligence"
          onChange={(value) =>
            draft.updateSelectedPattern((current) => ({
              ...current,
              requiredIntelligence: value,
            }))
          }
          value={pattern.requiredIntelligence}
        />
      </div>

      <section className="editor-zone-section">
        <fieldset className="editor-checkbox-grid">
          <legend>Required Weapon Types</legend>
          {EQUIPMENT_WEAPON_TYPE_OPTIONS.map((weaponType) => (
            <label className="editor-checkbox-field" key={weaponType}>
              <input
                checked={pattern.requiredWeaponTypes?.includes(weaponType) ?? false}
                disabled={draft.isSaving}
                onChange={(event) =>
                  draft.updateSelectedPattern((current) =>
                    setRequiredWeaponType(current, weaponType, event.target.checked),
                  )
                }
                type="checkbox"
              />
              <span>{weaponType}</span>
            </label>
          ))}
        </fieldset>
      </section>

      <section className="editor-zone-section">
        <h3>Evolution</h3>
        <label className="editor-checkbox-field">
          <input
            checked={pattern.evolvesFrom !== undefined}
            disabled={draft.isSaving || evolutionOptions.length === 0}
            onChange={(event) =>
              draft.updateSelectedPattern((current) => ({
                ...current,
                evolvesFrom: event.target.checked
                  ? {
                      patternId: evolutionOptions[0] ?? "",
                      usageRequired: 15,
                    }
                  : undefined,
              }))
            }
            type="checkbox"
          />
          <span>Evolves from another pattern</span>
        </label>
        {pattern.evolvesFrom ? (
          <div className="editor-form-row">
            <label className="editor-field">
              <span>Source pattern</span>
              <select
                disabled={draft.isSaving}
                onChange={(event) =>
                  draft.updateSelectedPattern((current) => ({
                    ...current,
                    evolvesFrom: {
                      patternId: event.target.value,
                      usageRequired: current.evolvesFrom?.usageRequired ?? 15,
                    },
                  }))
                }
                value={pattern.evolvesFrom.patternId}
              >
                {evolutionOptions.map((id) => (
                  <option key={id} value={id}>
                    {id}
                  </option>
                ))}
              </select>
            </label>
            <NumberField
              disabled={draft.isSaving}
              label="Usage Required"
              onChange={(value) =>
                draft.updateSelectedPattern((current) => ({
                  ...current,
                  evolvesFrom: {
                    patternId: current.evolvesFrom?.patternId ?? "",
                    usageRequired: value,
                  },
                }))
              }
              value={pattern.evolvesFrom.usageRequired}
            />
          </div>
        ) : null}
      </section>

      <div className="editor-actions">
        <EditorButton
          className="editor-action-button"
          disabled={!draft.canSaveSelectedPattern}
          onClick={draft.saveSelectedPattern}
        >
          Save Pattern
        </EditorButton>
        <EditorButton
          className="editor-action-button"
          disabled={!draft.canResetSelectedPattern}
          onClick={draft.resetSelectedPattern}
        >
          Reset
        </EditorButton>
        <EditorButton
          className="editor-action-button"
          disabled={!draft.canDeleteSelectedPattern}
          onClick={draft.deleteSelectedPattern}
        >
          Delete
        </EditorButton>
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

function NumberField({
  label,
  value,
  onChange,
  disabled,
  step,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  disabled: boolean;
  step?: number;
}) {
  return (
    <label className="editor-field">
      <span>{label}</span>
      <input
        disabled={disabled}
        onChange={(event) => onChange(Number(event.target.value))}
        step={step ?? 1}
        type="number"
        value={value}
      />
    </label>
  );
}

function setRequiredWeaponType(
  pattern: PatternDef,
  weaponType: EquipmentWeaponType,
  checked: boolean,
): PatternDef {
  const current = pattern.requiredWeaponTypes ?? [];
  const next = checked
    ? current.includes(weaponType)
      ? current
      : [...current, weaponType]
    : current.filter((entry) => entry !== weaponType);
  return {
    ...pattern,
    requiredWeaponTypes: next.length > 0 ? next : undefined,
  };
}
