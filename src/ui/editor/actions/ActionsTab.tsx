import { useState } from "react";
import {
  COMBAT_ACTION_CATEGORY_OPTIONS,
  formatContentDiagnostic,
  type CombatActionDef,
} from "../../../engine";
import { IdentifierLabel } from "../../components/IdentifierLabel";
import { ScrollRegion } from "../../components/ScrollRegion";
import { EditorButton } from "../components/EditorButton";
import { EditorPanel } from "../components/EditorPanel";
import {
  EditorGroupedList,
  type EditorGroupedListGroup,
} from "../EditorGroupedList";
import {
  ACTION_TUNING_FIELDS,
  addActionLine,
  groupActionsByCategory,
  removeActionLine,
  setActionTuning,
  updateActionLine,
  type ActionLineField,
} from "./actionEditorModel";
import type { ActionDraftController } from "./useActionDraft";

type ActionsTabProps = {
  draft: ActionDraftController;
};

export function ActionsTab({ draft }: ActionsTabProps) {
  const actionGroups: EditorGroupedListGroup[] = groupActionsByCategory(
    draft.actions,
  ).map(({ category, actions }) => ({
    key: category,
    label: category,
    entries: actions.map((action) => ({
      key: action.actionId,
      id: action.actionId,
      name: action.name,
      label: <IdentifierLabel value={action.actionId} />,
      meta: `${action.name} - order ${action.order}`,
      isUnsaved: action.hasUnsavedChanges,
    })),
  }));
  const [listFilter, setListFilter] = useState("");

  return (
    <>
      <section className="editor-summary" aria-label="Combat actions summary">
        <span>{draft.actions.length} actions</span>
        <span>{draft.errorCount} errors</span>
        <span>{draft.warningCount} warnings</span>
        <span>{draft.hasUnsavedChanges ? "unsaved" : "saved"}</span>
      </section>

      <div className="workbench">
        <ScrollRegion className="workbench__rail">
          <EditorPanel className="editor-panel editor-enemy-list">
            <h2 className="editor-panel__title">Actions</h2>
            <EditorGroupedList
              emptyLabel="No matching actions."
              filter={listFilter}
              groups={actionGroups}
              onFilterChange={setListFilter}
              onSelect={(entry) => draft.selectAction(entry.id)}
              selectedEntryKey={draft.selectedActionId}
            />
          </EditorPanel>
        </ScrollRegion>

        <ScrollRegion className="workbench__main">
          <EditorPanel className="editor-panel editor-enemy-editor">
            <h2 className="editor-panel__title">Action</h2>
            {draft.selectedAction ? (
              <ActionForm action={draft.selectedAction} draft={draft} />
            ) : (
              <p className="editor-empty">No action selected.</p>
            )}
          </EditorPanel>
        </ScrollRegion>

        <ScrollRegion className="workbench__inspector">
          <EditorPanel className="editor-panel editor-enemy-problems">
            <h2 className="editor-panel__title">Problems</h2>
            <section className="editor-zone-section">
              <div className="editor-family__header">
                <h3>Selected Action</h3>
                <span>{draft.selectedActionDiagnostics.length}</span>
              </div>
              {draft.selectedActionDiagnostics.length === 0 ? (
                <p className="editor-empty">No problems.</p>
              ) : (
                <ul className="editor-diagnostic-list">
                  {draft.selectedActionDiagnostics.map((diagnostic, index) => (
                    <li
                      className={`editor-diagnostic editor-diagnostic--${diagnostic.severity}`}
                      key={`${diagnostic.contentId ?? "action"}-${diagnostic.path}-${index}`}
                    >
                      {formatContentDiagnostic(diagnostic)}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </EditorPanel>
        </ScrollRegion>
      </div>
    </>
  );
}

function ActionForm({
  action,
  draft,
}: {
  action: CombatActionDef;
  draft: ActionDraftController;
}) {
  return (
    <section className="editor-item-form" aria-label="Combat action editor">
      <div className="editor-family__header">
        <h3>{action.name}</h3>
        <span>
          {draft.selectedActionHasUnsavedChanges ? "dirty" : "clean"}
        </span>
      </div>

      <label className="editor-field">
        <span>Action Id</span>
        <input disabled readOnly type="text" value={action.actionId} />
      </label>

      <label className="editor-field">
        <span>Name</span>
        <input
          disabled={draft.isSaving}
          onChange={(event) =>
            draft.updateSelectedAction((current) => ({
              ...current,
              name: event.target.value,
            }))
          }
          type="text"
          value={action.name}
        />
      </label>

      <div className="editor-form-row">
        <label className="editor-field">
          <span>Category</span>
          <select
            disabled={draft.isSaving}
            onChange={(event) =>
              draft.updateSelectedAction((current) => ({
                ...current,
                category: event.target
                  .value as CombatActionDef["category"],
              }))
            }
            value={action.category}
          >
            {COMBAT_ACTION_CATEGORY_OPTIONS.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </label>
        <label className="editor-field">
          <span>Order</span>
          <input
            disabled={draft.isSaving}
            min={0}
            onChange={(event) =>
              draft.updateSelectedAction((current) => ({
                ...current,
                order: parseIntInput(event.target.value, current.order),
              }))
            }
            step={1}
            type="number"
            value={action.order}
          />
        </label>
      </div>

      <label className="editor-field">
        <span>Summary</span>
        <input
          disabled={draft.isSaving}
          onChange={(event) =>
            draft.updateSelectedAction((current) => ({
              ...current,
              summary: event.target.value,
            }))
          }
          type="text"
          value={action.summary}
        />
      </label>

      <label className="editor-field">
        <span>Formula</span>
        <textarea
          disabled={draft.isSaving}
          onChange={(event) =>
            draft.updateSelectedAction((current) => ({
              ...current,
              formula: event.target.value,
            }))
          }
          rows={2}
          value={action.formula}
        />
      </label>

      <section className="editor-enemy-stat-section">
        <div className="editor-family__header">
          <h3>Tuning</h3>
        </div>
        <div className="editor-enemy-stat-grid">
          {ACTION_TUNING_FIELDS.map(({ field, label, kind }) => (
            <label className="editor-field" key={field}>
              <span>{label}</span>
              <input
                disabled={draft.isSaving}
                min={0}
                onChange={(event) =>
                  draft.updateSelectedAction((current) =>
                    setActionTuning(
                      current,
                      field,
                      parseTuningInput(event.target.value),
                    ),
                  )
                }
                step={kind === "multiplier" ? 0.1 : 1}
                type="number"
                value={formatNumberInput(action.tuning?.[field])}
              />
            </label>
          ))}
        </div>
      </section>

      <section className="editor-zone-section">
        <div className="editor-family__header">
          <h3>Derived Effect Lines</h3>
          <span>{draft.derivedEffects.length}</span>
        </div>
        {draft.derivedEffects.length === 0 ? (
          <p className="editor-empty">Tuning adds no numeric lines.</p>
        ) : (
          <ul className="editor-diagnostic-list">
            {draft.derivedEffects.map((line, index) => (
              <li className="editor-derived-line" key={index}>
                {line}
              </li>
            ))}
          </ul>
        )}
        <p className="editor-placement-hint">
          These lines are generated from tuning and prepended to the authored
          effects below; do not repeat them here.
        </p>
      </section>

      <ActionLineList
        action={action}
        draft={draft}
        field="effects"
        title="Authored Effects"
      />
      <ActionLineList
        action={action}
        draft={draft}
        field="details"
        title="Details"
      />

      <div className="editor-actions">
        <EditorButton
          className="editor-action-button"
          disabled={!draft.canSaveSelectedAction}
          onClick={draft.saveSelectedAction}
        >
          Save Action
        </EditorButton>
        <EditorButton
          className="editor-action-button"
          disabled={!draft.canResetSelectedAction}
          onClick={draft.resetSelectedAction}
        >
          Reset
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

function ActionLineList({
  action,
  draft,
  field,
  title,
}: {
  action: CombatActionDef;
  draft: ActionDraftController;
  field: ActionLineField;
  title: string;
}) {
  const lines = action[field];

  return (
    <section className="editor-zone-section">
      <div className="editor-family__header">
        <h3>{title}</h3>
        <span>{lines.length}</span>
      </div>
      {lines.length === 0 ? (
        <p className="editor-empty">None.</p>
      ) : (
        <ul className="editor-zone-row-list">
          {lines.map((line, index) => (
            <li className="editor-zone-row" key={index}>
              <div className="editor-form-row">
                <label className="editor-field editor-field--grow">
                  <span>Line {index + 1}</span>
                  <input
                    disabled={draft.isSaving}
                    onChange={(event) =>
                      draft.updateSelectedAction((current) =>
                        updateActionLine(
                          current,
                          field,
                          index,
                          event.target.value,
                        ),
                      )
                    }
                    type="text"
                    value={line}
                  />
                </label>
                <EditorButton
                  className="editor-compact-button"
                  disabled={draft.isSaving}
                  onClick={() =>
                    draft.updateSelectedAction((current) =>
                      removeActionLine(current, field, index),
                    )
                  }
                >
                  Delete
                </EditorButton>
              </div>
            </li>
          ))}
        </ul>
      )}
      <EditorButton
        className="editor-action-button"
        disabled={draft.isSaving}
        onClick={() =>
          draft.updateSelectedAction((current) => addActionLine(current, field))
        }
      >
        Add Line
      </EditorButton>
    </section>
  );
}

function parseIntInput(value: string, fallback: number): number {
  const parsed = Math.round(Number(value));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseTuningInput(value: string): number | undefined {
  return value.trim() === "" ? undefined : Number(value);
}

function formatNumberInput(value: number | undefined): string {
  return value !== undefined && Number.isFinite(value) ? String(value) : "";
}
