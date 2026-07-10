import { useState } from "react";
import {
  QUEST_STAT_NAME_OPTIONS,
  type ContentCatalogSnapshot,
  type ContentReference,
  type QuestDef,
  type QuestObjective,
} from "../../../engine";
import type { GridCell } from "../../../rendering/canvasCellMapping";
import { IdentifierLabel } from "../../components/IdentifierLabel";
import { ScrollRegion } from "../../components/ScrollRegion";
import { EditorButton } from "../components/EditorButton";
import { EditorPanel } from "../components/EditorPanel";
import {
  DiagnosticList,
  type EditorContentNavigationTarget,
} from "../DiagnosticList";
import { formatContentRef } from "../editorModel";
import { EditorGroupedList } from "../EditorGroupedList";
import { MapCoordinatePicker } from "../MapCoordinatePicker";
import {
  addObjective,
  addQuestOverride,
  addRewardItem,
  moveObjective,
  QUEST_OBJECTIVE_TYPE_OPTIONS,
  removeObjectiveAt,
  removeQuestOverride,
  removeRewardItem,
  setObjectiveType,
  setQuestOverride,
  setQuestTrigger,
  setRewardCurrency,
  setRewardXp,
  updateObjectiveAt,
  updateRewardItem,
  type QuestObjectiveType,
} from "./questEditorModel";
import type { QuestDraftController } from "./useQuestDraft";

type QuestTabProps = {
  draft: QuestDraftController;
  onNavigate: (target: EditorContentNavigationTarget) => void;
  snapshot: ContentCatalogSnapshot;
};

type CoordinatePickerRequest = {
  index: number;
  zoneId: string;
  onPick: (cell: GridCell) => void;
};

export function QuestTab({ draft, onNavigate, snapshot }: QuestTabProps) {
  const [listFilter, setListFilter] = useState("");

  return (
    <>
      <section className="editor-summary" aria-label="Quest summary">
        <span>{draft.quests.length} quests</span>
        <span>{draft.errorCount} errors</span>
        <span>{draft.warningCount} warnings</span>
        <span>{draft.hasUnsavedChanges ? "unsaved" : "saved"}</span>
      </section>

      <div className="workbench">
        <ScrollRegion className="workbench__rail">
          <EditorPanel className="editor-panel editor-enemy-list">
            <h2 className="editor-panel__title">Quests</h2>
            <EditorGroupedList
              emptyLabel="No matching quests."
              filter={listFilter}
              groups={[{
                key: "quests",
                label: "Quests",
                entries: draft.quests.map((quest) => ({
                  key: quest.questId,
                  id: quest.questId,
                  name: quest.name,
                  label: <IdentifierLabel value={quest.questId} />,
                  meta: quest.name,
                  isUnsaved: quest.hasUnsavedChanges,
                })),
              }]}
              onFilterChange={setListFilter}
              onSelect={(entry) => draft.selectQuest(entry.id)}
              selectedEntryKey={draft.selectedQuestId}
            />
            <NewQuestForm draft={draft} />
          </EditorPanel>
        </ScrollRegion>

        <ScrollRegion className="workbench__main">
          <EditorPanel className="editor-panel editor-enemy-editor">
            <h2 className="editor-panel__title">Quest</h2>
            {draft.selectedQuest ? (
              <QuestForm
                draft={draft}
                quest={draft.selectedQuest}
                snapshot={snapshot}
              />
            ) : (
              <p className="editor-empty">No quest selected.</p>
            )}
          </EditorPanel>
        </ScrollRegion>

        <ScrollRegion className="workbench__inspector">
          <EditorPanel className="editor-panel editor-enemy-problems">
            <h2 className="editor-panel__title">Problems</h2>
            <section className="editor-zone-section">
              <div className="editor-family__header">
                <h3>Selected Quest</h3>
                <span>{draft.selectedQuestDiagnostics.length}</span>
              </div>
              {draft.selectedQuestDiagnostics.length === 0 ? (
                <p className="editor-empty">No problems.</p>
              ) : (
                <DiagnosticList
                  diagnostics={draft.selectedQuestDiagnostics}
                  onNavigate={onNavigate}
                />
              )}
            </section>
            <QuestReferences
              onNavigate={onNavigate}
              references={draft.selectedQuestReferences}
            />
          </EditorPanel>
        </ScrollRegion>
      </div>
    </>
  );
}

function NewQuestForm({ draft }: { draft: QuestDraftController }) {
  return (
    <section className="editor-item-form" aria-label="New quest">
      <div className="editor-family__header">
        <h3>New Quest</h3>
      </div>
      <label className="editor-field">
        <span>Quest Id</span>
        <input
          onChange={(event) => draft.setNewQuestIdDraft(event.target.value)}
          placeholder="lost_ring"
          type="text"
          value={draft.newQuestIdDraft}
        />
      </label>
      <label className="editor-field">
        <span>Name</span>
        <input
          onChange={(event) => draft.setNewQuestNameDraft(event.target.value)}
          type="text"
          value={draft.newQuestNameDraft}
        />
      </label>
      {draft.newQuestIdErrors.length > 0 && draft.newQuestIdDraft.trim() ? (
        <p className="editor-field-error">{draft.newQuestIdErrors[0]}</p>
      ) : null}
      <EditorButton
        className="editor-action-button"
        disabled={!draft.canCreateQuest}
        onClick={draft.createQuest}
      >
        Create Quest
      </EditorButton>
    </section>
  );
}

function QuestForm({
  draft,
  quest,
  snapshot,
}: {
  draft: QuestDraftController;
  quest: QuestDef;
  snapshot: ContentCatalogSnapshot;
}) {
  const update = draft.updateSelectedQuest;

  return (
    <section className="editor-item-form" aria-label="Quest editor">
      <div className="editor-family__header">
        <h3>{quest.name || quest.questId}</h3>
        <span>{draft.selectedQuestHasUnsavedChanges ? "dirty" : "clean"}</span>
      </div>

      <label className="editor-field">
        <span>Quest Id</span>
        <input disabled readOnly type="text" value={quest.questId} />
      </label>
      <p className="editor-placement-hint">
        Quest ids are persisted in saves — they cannot be renamed here.
      </p>

      <label className="editor-field">
        <span>Name</span>
        <input
          disabled={draft.isSaving}
          onChange={(event) =>
            update((current) => ({ ...current, name: event.target.value }))
          }
          type="text"
          value={quest.name}
        />
      </label>
      <label className="editor-field">
        <span>Description</span>
        <textarea
          disabled={draft.isSaving}
          onChange={(event) =>
            update((current) => ({
              ...current,
              description: event.target.value,
            }))
          }
          rows={2}
          value={quest.description}
        />
      </label>

      <label className="editor-field">
        <span>Target NPC (optional)</span>
        <select
          disabled={draft.isSaving}
          onChange={(event) =>
            update((current) => ({
              ...current,
              targetNpcId: event.target.value || undefined,
            }))
          }
          value={quest.targetNpcId ?? ""}
        >
          <option value="">(select an NPC)</option>
          {optionsWith(draft.npcIds, quest.targetNpcId ?? "").map((npcId) => (
            <option key={npcId} value={npcId}>
              {npcId}
            </option>
          ))}
        </select>
      </label>

      <div className="editor-form-row">
        <TriggerField
          dialogueIds={draft.dialogueIds}
          disabled={draft.isSaving}
          label="Start Dialogue (optional)"
          onChange={(dialogueId) =>
            update((current) => setQuestTrigger(current, "start", dialogueId))
          }
          value={quest.triggers.start.dialogueId ?? ""}
        />
        <TriggerField
          dialogueIds={draft.dialogueIds}
          disabled={draft.isSaving}
          label="Complete Dialogue (optional)"
          onChange={(dialogueId) =>
            update((current) => setQuestTrigger(current, "complete", dialogueId))
          }
          value={quest.triggers.complete.dialogueId ?? ""}
        />
      </div>

      <QuestOverridesEditor draft={draft} quest={quest} />
      <QuestRewardsEditor draft={draft} quest={quest} />
      <QuestObjectivesEditor draft={draft} quest={quest} snapshot={snapshot} />

      <div className="editor-actions">
        <EditorButton
          className="editor-action-button"
          disabled={!draft.canSaveSelectedQuest}
          onClick={draft.saveSelectedQuest}
        >
          Save Quest
        </EditorButton>
        <EditorButton
          className="editor-action-button"
          disabled={!draft.canResetSelectedQuest}
          onClick={draft.resetSelectedQuest}
        >
          Reset
        </EditorButton>
      </div>
      <EditorButton
        className="editor-action-button"
        disabled={!draft.canDeleteSelectedQuest}
        onClick={draft.deleteSelectedQuest}
      >
        Delete Quest
      </EditorButton>
      <p className="editor-placement-hint">
        Deleting a quest orphans any save-state entry for it; saves are
        disposable, so this is only a warning.
      </p>
      <p
        aria-live="polite"
        className={`editor-save-status editor-save-status--${draft.saveStatus.state}`}
      >
        {draft.saveStatus.message}
      </p>
    </section>
  );
}

function TriggerField({
  label,
  value,
  dialogueIds,
  disabled,
  onChange,
}: {
  label: string;
  value: string;
  dialogueIds: string[];
  disabled: boolean;
  onChange: (dialogueId: string) => void;
}) {
  return (
    <label className="editor-field">
      <span>{label}</span>
      <select
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        value={value}
      >
        <option value="">(select a dialogue)</option>
        {optionsWith(dialogueIds, value).map((dialogueId) => (
          <option key={dialogueId} value={dialogueId}>
            {dialogueId}
          </option>
        ))}
      </select>
    </label>
  );
}

function QuestOverridesEditor({
  draft,
  quest,
}: {
  draft: QuestDraftController;
  quest: QuestDef;
}) {
  const [addNpcId, setAddNpcId] = useState(draft.npcIds[0] ?? "");
  const overrideEntries = Object.entries(quest.npcOverrides);

  return (
    <section className="editor-zone-section">
      <div className="editor-family__header">
        <h3>NPC Dialogue Overrides</h3>
        <span>{overrideEntries.length}</span>
      </div>
      {overrideEntries.length === 0 ? (
        <p className="editor-empty">No overrides.</p>
      ) : (
        <ul className="editor-zone-row-list">
          {overrideEntries.map(([npcId, override]) => (
            <li className="editor-zone-row" key={npcId}>
              <div className="editor-zone-row__head">
                <strong>{npcId}</strong>
                <EditorButton
                  className="editor-compact-button"
                  disabled={draft.isSaving}
                  onClick={() =>
                    draft.updateSelectedQuest((current) =>
                      removeQuestOverride(current, npcId),
                    )
                  }
                >
                  Remove
                </EditorButton>
              </div>
              {(["active", "activeReady", "completed"] as const).map((field) => (
                <label className="editor-field" key={field}>
                  <span>{field}</span>
                  <select
                    disabled={draft.isSaving}
                    onChange={(event) =>
                      draft.updateSelectedQuest((current) =>
                        setQuestOverride(current, npcId, {
                          [field]: event.target.value || undefined,
                        }),
                      )
                    }
                    value={override[field] ?? ""}
                  >
                    <option value="">(none)</option>
                    {optionsWith(draft.dialogueIds, override[field] ?? "").map(
                      (dialogueId) => (
                        <option key={dialogueId} value={dialogueId}>
                          {dialogueId}
                        </option>
                      ),
                    )}
                  </select>
                </label>
              ))}
            </li>
          ))}
        </ul>
      )}
      <div className="editor-form-row">
        <label className="editor-field editor-field--grow">
          <span>NPC</span>
          <select
            disabled={draft.isSaving}
            onChange={(event) => setAddNpcId(event.target.value)}
            value={addNpcId}
          >
            {draft.npcIds.map((npcId) => (
              <option key={npcId} value={npcId}>
                {npcId}
              </option>
            ))}
          </select>
        </label>
        <EditorButton
          className="editor-compact-button"
          disabled={draft.isSaving || !addNpcId}
          onClick={() =>
            draft.updateSelectedQuest((current) =>
              addQuestOverride(current, addNpcId),
            )
          }
        >
          Add Override
        </EditorButton>
      </div>
    </section>
  );
}

function QuestRewardsEditor({
  draft,
  quest,
}: {
  draft: QuestDraftController;
  quest: QuestDef;
}) {
  const items = quest.rewards.items ?? [];

  return (
    <section className="editor-zone-section">
      <div className="editor-family__header">
        <h3>Rewards</h3>
        <span>{items.length}</span>
      </div>
      <label className="editor-field">
        <span>Currency</span>
        <input
          disabled={draft.isSaving}
          min={0}
          onChange={(event) =>
            draft.updateSelectedQuest((current) =>
              setRewardCurrency(current, parseOptionalInt(event.target.value)),
            )
          }
          step={1}
          type="number"
          value={quest.rewards.currency ?? ""}
        />
      </label>
      <label className="editor-field">
        <span>XP</span>
        <input
          disabled={draft.isSaving}
          min={0}
          onChange={(event) =>
            draft.updateSelectedQuest((current) =>
              setRewardXp(current, parseOptionalInt(event.target.value)),
            )
          }
          step={1}
          type="number"
          value={quest.rewards.xp ?? ""}
        />
      </label>
      {items.length > 0 ? (
        <ul className="editor-zone-row-list">
          {items.map((item, index) => (
            <li className="editor-zone-row" key={`${item.itemId}-${index}`}>
              <div className="editor-form-row">
                <label className="editor-field">
                  <span>Item</span>
                  <select
                    disabled={draft.isSaving}
                    onChange={(event) =>
                      draft.updateSelectedQuest((current) =>
                        updateRewardItem(current, index, {
                          itemId: event.target.value,
                        }),
                      )
                    }
                    value={item.itemId}
                  >
                    {optionsWith(draft.itemIds, item.itemId).map((itemId) => (
                      <option key={itemId} value={itemId}>
                        {itemId}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="editor-field">
                  <span>Quantity</span>
                  <input
                    disabled={draft.isSaving}
                    min={1}
                    onChange={(event) =>
                      draft.updateSelectedQuest((current) =>
                        updateRewardItem(current, index, {
                          quantity: parseIntOr(event.target.value, item.quantity),
                        }),
                      )
                    }
                    step={1}
                    type="number"
                    value={item.quantity}
                  />
                </label>
                <EditorButton
                  className="editor-compact-button"
                  disabled={draft.isSaving}
                  onClick={() =>
                    draft.updateSelectedQuest((current) =>
                      removeRewardItem(current, index),
                    )
                  }
                >
                  Remove
                </EditorButton>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
      <EditorButton
        className="editor-compact-button"
        disabled={draft.isSaving || draft.itemIds.length === 0}
        onClick={() =>
          draft.updateSelectedQuest((current) =>
            addRewardItem(current, draft.itemIds[0] ?? ""),
          )
        }
      >
        Add Reward Item
      </EditorButton>
    </section>
  );
}

function QuestObjectivesEditor({
  draft,
  quest,
  snapshot,
}: {
  draft: QuestDraftController;
  quest: QuestDef;
  snapshot: ContentCatalogSnapshot;
}) {
  const [newType, setNewType] = useState<QuestObjectiveType>("fetch_item");
  const [coordinatePicker, setCoordinatePicker] =
    useState<CoordinatePickerRequest | null>(null);
  const update = draft.updateSelectedQuest;

  return (
    <section className="editor-zone-section">
      <div className="editor-family__header">
        <h3>Objectives</h3>
        <span>{quest.objectives.length}</span>
      </div>
      {quest.objectives.length === 0 ? (
        <p className="editor-empty">No objectives.</p>
      ) : (
        <ul className="editor-zone-row-list">
          {quest.objectives.map((objective, index) => (
            <li className="editor-zone-row" key={index}>
              <div className="editor-form-row">
                <label className="editor-field editor-field--grow">
                  <span>Objective Id</span>
                  <input
                    disabled={draft.isSaving}
                    onChange={(event) =>
                      update((current) =>
                        updateObjectiveAt(current, index, {
                          id: event.target.value,
                        }),
                      )
                    }
                    type="text"
                    value={objective.id}
                  />
                </label>
                <label className="editor-field">
                  <span>Type</span>
                  <select
                    disabled={draft.isSaving}
                    onChange={(event) =>
                      update((current) =>
                        setObjectiveType(
                          current,
                          index,
                          event.target.value as QuestObjectiveType,
                        ),
                      )
                    }
                    value={objective.type}
                  >
                    {QUEST_OBJECTIVE_TYPE_OPTIONS.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <ObjectiveTypeFields
                draft={draft}
                index={index}
                onPickCoordinate={(zoneId) =>
                  setCoordinatePicker({
                    index,
                    zoneId,
                    onPick: (cell) =>
                      update((current) =>
                        updateObjectiveAt(current, index, {
                          x: cell.x,
                          y: cell.y,
                        }),
                      ),
                  })
                }
                objective={objective}
              />

              <label className="editor-field">
                <span>Description</span>
                <input
                  disabled={draft.isSaving}
                  onChange={(event) =>
                    update((current) =>
                      updateObjectiveAt(current, index, {
                        description: event.target.value,
                      }),
                    )
                  }
                  type="text"
                  value={objective.description}
                />
              </label>

              <div className="editor-actions">
                <EditorButton
                  className="editor-compact-button"
                  disabled={draft.isSaving || index === 0}
                  onClick={() =>
                    update((current) => moveObjective(current, index, -1))
                  }
                >
                  Up
                </EditorButton>
                <EditorButton
                  className="editor-compact-button"
                  disabled={
                    draft.isSaving || index === quest.objectives.length - 1
                  }
                  onClick={() =>
                    update((current) => moveObjective(current, index, 1))
                  }
                >
                  Down
                </EditorButton>
                <EditorButton
                  className="editor-compact-button"
                  disabled={draft.isSaving}
                  onClick={() =>
                    update((current) => removeObjectiveAt(current, index))
                  }
                >
                  Delete
                </EditorButton>
              </div>
            </li>
          ))}
        </ul>
      )}
      <div className="editor-form-row">
        <label className="editor-field editor-field--grow">
          <span>New objective type</span>
          <select
            disabled={draft.isSaving}
            onChange={(event) =>
              setNewType(event.target.value as QuestObjectiveType)
            }
            value={newType}
          >
            {QUEST_OBJECTIVE_TYPE_OPTIONS.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </label>
        <EditorButton
          className="editor-compact-button"
          disabled={draft.isSaving}
          onClick={() =>
            update((current) => addObjective(current, newType))
          }
        >
          Add Objective
        </EditorButton>
      </div>
      {coordinatePicker ? (
        <MapCoordinatePicker
          onClose={() => setCoordinatePicker(null)}
          onPick={coordinatePicker.onPick}
          snapshot={snapshot}
          title={`Pick objective coordinate ${coordinatePicker.index + 1}`}
          zoneId={coordinatePicker.zoneId}
        />
      ) : null}
    </section>
  );
}

function ObjectiveTypeFields({
  draft,
  index,
  onPickCoordinate,
  objective,
}: {
  draft: QuestDraftController;
  index: number;
  onPickCoordinate: (zoneId: string) => void;
  objective: QuestObjective;
}) {
  const update = draft.updateSelectedQuest;

  if (objective.type === "fetch_item") {
    return (
      <div className="editor-form-row">
        <label className="editor-field">
          <span>Item</span>
          <select
            disabled={draft.isSaving}
            onChange={(event) =>
              update((current) =>
                updateObjectiveAt(current, index, { itemId: event.target.value }),
              )
            }
            value={objective.itemId}
          >
            <option value="">(select an item)</option>
            {optionsWith(draft.itemIds, objective.itemId).map((itemId) => (
              <option key={itemId} value={itemId}>
                {itemId}
              </option>
            ))}
          </select>
        </label>
        <QuantityField
          disabled={draft.isSaving}
          onChange={(quantity) =>
            update((current) => updateObjectiveAt(current, index, { quantity }))
          }
          value={objective.quantity}
        />
      </div>
    );
  }

  if (objective.type === "visit_coordinate") {
    return (
      <div className="editor-form-row">
        <label className="editor-field">
          <span>Zone</span>
          <select
            disabled={draft.isSaving}
            onChange={(event) =>
              update((current) =>
                updateObjectiveAt(current, index, { zoneId: event.target.value }),
              )
            }
            value={objective.zoneId}
          >
            <option value="">(select a zone)</option>
            {optionsWith(draft.zoneIds, objective.zoneId).map((zoneId) => (
              <option key={zoneId} value={zoneId}>
                {zoneId}
              </option>
            ))}
          </select>
        </label>
        <label className="editor-field">
          <span>X</span>
          <input
            disabled={draft.isSaving}
            min={0}
            onChange={(event) =>
              update((current) =>
                updateObjectiveAt(current, index, {
                  x: intOr(event.target.value, objective.x),
                }),
              )
            }
            step={1}
            type="number"
            value={objective.x}
          />
        </label>
        <label className="editor-field">
          <span>Y</span>
          <input
            disabled={draft.isSaving}
            min={0}
            onChange={(event) =>
              update((current) =>
                updateObjectiveAt(current, index, {
                  y: intOr(event.target.value, objective.y),
                }),
              )
            }
            step={1}
            type="number"
            value={objective.y}
          />
        </label>
        <EditorButton
          className="editor-compact-button"
          disabled={draft.isSaving || !draft.zoneIds.includes(objective.zoneId)}
          onClick={() => onPickCoordinate(objective.zoneId)}
        >
          Pick on Map
        </EditorButton>
      </div>
    );
  }

  if (objective.type === "stat_threshold") {
    return (
      <div className="editor-form-row">
        <label className="editor-field editor-field--grow">
          <span>Stat</span>
          <select
            disabled={draft.isSaving}
            onChange={(event) =>
              update((current) =>
                updateObjectiveAt(current, index, {
                  statName: event.target.value,
                }),
              )
            }
            value={objective.statName}
          >
            {optionsWith(
              [...QUEST_STAT_NAME_OPTIONS],
              objective.statName,
            ).map((statName) => (
              <option key={statName} value={statName}>
                {statName}
              </option>
            ))}
          </select>
        </label>
        <label className="editor-field">
          <span>Threshold</span>
          <input
            disabled={draft.isSaving}
            onChange={(event) =>
              update((current) =>
                updateObjectiveAt(current, index, {
                  threshold: intOr(event.target.value, objective.threshold),
                }),
              )
            }
            step={1}
            type="number"
            value={objective.threshold}
          />
        </label>
      </div>
    );
  }

  return (
    <div className="editor-form-row">
      <label className="editor-field">
        <span>NPC</span>
        <select
          disabled={draft.isSaving}
          onChange={(event) =>
            update((current) =>
              updateObjectiveAt(current, index, { npcId: event.target.value }),
            )
          }
          value={objective.npcId}
        >
          <option value="">(select an NPC)</option>
          {optionsWith(draft.npcIds, objective.npcId).map((npcId) => (
            <option key={npcId} value={npcId}>
              {npcId}
            </option>
          ))}
        </select>
      </label>
      <QuantityField
        disabled={draft.isSaving}
        onChange={(quantity) =>
          update((current) => updateObjectiveAt(current, index, { quantity }))
        }
        value={objective.quantity}
      />
    </div>
  );
}

function QuantityField({
  value,
  disabled,
  onChange,
}: {
  value: number;
  disabled: boolean;
  onChange: (quantity: number) => void;
}) {
  return (
    <label className="editor-field">
      <span>Quantity</span>
      <input
        disabled={disabled}
        min={1}
        onChange={(event) => onChange(intOr(event.target.value, value))}
        step={1}
        type="number"
        value={value}
      />
    </label>
  );
}

function QuestReferences({
  onNavigate,
  references,
}: {
  onNavigate: (target: EditorContentNavigationTarget) => void;
  references: ContentReference[];
}) {
  return (
    <section className="editor-reference-list">
      <h3>Incoming References</h3>
      {references.length === 0 ? (
        <p className="editor-empty">No incoming references.</p>
      ) : (
        <ul>
          {references.map((reference, index) => (
            <li key={`${reference.from.type}-${reference.from.id}-${index}`}>
              <button
                className="editor-reference-link"
                onClick={() => onNavigate(reference.from)}
                type="button"
              >
                {formatContentRef(reference.from)}
              </button>
              <strong>{reference.path}</strong>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function optionsWith(ids: readonly string[], current: string): string[] {
  return [...new Set([current, ...ids].filter(Boolean))];
}

function parseOptionalInt(value: string): number | undefined {
  return value.trim() === "" ? undefined : Math.round(Number(value));
}

function parseIntOr(value: string, fallback: number): number {
  const parsed = Math.round(Number(value));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function intOr(value: string, fallback: number): number {
  return parseIntOr(value, fallback);
}
