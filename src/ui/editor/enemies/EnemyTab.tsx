import {
  formatContentDiagnostic,
  type EnemyDef,
} from "../../../engine";
import { IdentifierLabel } from "../../components/IdentifierLabel";
import { ScrollRegion } from "../../components/ScrollRegion";
import { TerminalButton } from "../../components/TerminalButton";
import { TerminalPanel } from "../../components/TerminalPanel";
import type { EditorContentNavigationTarget } from "../DiagnosticList";
import { ReferenceList } from "../ReferenceList";
import {
  addEnemyLootEntry,
  ENEMY_STAT_SECTIONS,
  removeEnemyLootEntry,
  updateEnemyLootEntry,
  updateEnemyProgression,
  updateEnemyStatValue,
  type EnemyStatSectionConfig,
} from "./enemyEditorModel";
import type { EnemyDraftController } from "./useEnemyDraft";

type EnemyTabProps = {
  draft: EnemyDraftController;
  onNavigate: (target: EditorContentNavigationTarget) => void;
};

export function EnemyTab({ draft, onNavigate }: EnemyTabProps) {
  const profileCount = draft.npcs.filter((npc) => npc.hasProfile).length;

  return (
    <>
      <section className="editor-summary" aria-label="Enemy summary">
        <span>{draft.npcs.length} NPCs</span>
        <span>{profileCount} profiles</span>
        <span>{draft.errorCount} errors</span>
        <span>{draft.warningCount} warnings</span>
        <span>{draft.hasUnsavedChanges ? "unsaved" : "saved"}</span>
      </section>

      <div className="workbench">
        <ScrollRegion className="workbench__rail">
          <TerminalPanel className="editor-panel editor-enemy-list">
            <h2 className="editor-panel__title">NPCs</h2>
            <div className="editor-entry-list">
              {draft.npcs.map((npc) => (
                <TerminalButton
                  className="editor-entry-button"
                  isSelected={npc.npcId === draft.selectedNpcId}
                  key={npc.npcId}
                  onClick={() => draft.selectNpc(npc.npcId)}
                >
                  <span className="editor-zone-entry">
                    <span className="editor-zone-entry__name">
                      <IdentifierLabel value={npc.npcId} />
                      {npc.hasUnsavedChanges ? " *" : ""}
                    </span>
                    <span className="editor-zone-entry__meta">
                      {npc.name} -{" "}
                      {npc.hasProfile
                        ? npc.combatable
                          ? "combatable"
                          : "inactive profile"
                        : "no profile"}
                    </span>
                  </span>
                </TerminalButton>
              ))}
            </div>
          </TerminalPanel>
        </ScrollRegion>

        <ScrollRegion className="workbench__main">
          <TerminalPanel className="editor-panel editor-enemy-editor">
            <h2 className="editor-panel__title">Profile</h2>
            {draft.selectedNpc ? (
              draft.selectedEnemy ? (
                <EnemyProfileForm draft={draft} enemy={draft.selectedEnemy} />
              ) : (
                <CreateEnemyProfile draft={draft} />
              )
            ) : (
              <p className="editor-empty">No NPC selected.</p>
            )}
          </TerminalPanel>
        </ScrollRegion>

        <ScrollRegion className="workbench__inspector">
          <TerminalPanel className="editor-panel editor-enemy-problems">
            <h2 className="editor-panel__title">Problems</h2>
            <section className="editor-zone-section">
              <div className="editor-family__header">
                <h3>Selected Profile</h3>
                <span>{draft.selectedEnemyDiagnostics.length}</span>
              </div>
              {draft.selectedEnemyDiagnostics.length === 0 ? (
                <p className="editor-empty">No problems.</p>
              ) : (
                <ul className="editor-diagnostic-list">
                  {draft.selectedEnemyDiagnostics.map((diagnostic, index) => (
                    <li
                      className={`editor-diagnostic editor-diagnostic--${diagnostic.severity}`}
                      key={`${diagnostic.contentId ?? "enemy"}-${diagnostic.path}-${index}`}
                    >
                      {formatContentDiagnostic(diagnostic)}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <ReferenceList
              emptyLabel="No incoming references."
              onNavigate={onNavigate}
              references={draft.selectedEnemyReferences}
              title="Incoming References"
              useTarget={false}
            />
          </TerminalPanel>
        </ScrollRegion>
      </div>
    </>
  );
}

function CreateEnemyProfile({ draft }: { draft: EnemyDraftController }) {
  return (
    <section className="editor-item-form" aria-label="Enemy profile creator">
      <div className="editor-family__header">
        <h3>{draft.selectedNpc?.name ?? draft.selectedNpcId}</h3>
        <span>no profile</span>
      </div>
      <p className="editor-empty">
        No combat profile exists for this NPC.
      </p>
      <BalanceHint />
      <TerminalButton
        className="editor-action-button"
        disabled={!draft.canCreateSelectedEnemy}
        onClick={draft.createSelectedEnemy}
      >
        Create Profile
      </TerminalButton>
      <p
        aria-live="polite"
        className={`editor-save-status editor-save-status--${draft.saveStatus.state}`}
      >
        {draft.saveStatus.message}
      </p>
    </section>
  );
}

function EnemyProfileForm({
  draft,
  enemy,
}: {
  draft: EnemyDraftController;
  enemy: EnemyDef;
}) {
  return (
    <section className="editor-item-form" aria-label="Enemy profile editor">
      <div className="editor-family__header">
        <h3>{draft.selectedNpc?.name ?? enemy.npcId}</h3>
        <span>{draft.selectedEnemyHasUnsavedChanges ? "dirty" : "clean"}</span>
      </div>

      <label className="editor-field">
        <span>NPC Id</span>
        <input disabled readOnly type="text" value={enemy.npcId} />
      </label>

      <label className="editor-checkbox-field">
        <input
          checked={enemy.combatable}
          disabled={draft.isSaving}
          onChange={(event) =>
            draft.updateSelectedEnemy((current) => ({
              ...current,
              combatable: event.target.checked,
            }))
          }
          type="checkbox"
        />
        <span>Combatable</span>
      </label>

      <BalanceHint />

      {ENEMY_STAT_SECTIONS.map((section) => (
        <EnemyStatSection
          draft={draft}
          enemy={enemy}
          key={section.section}
          section={section}
        />
      ))}

      <section className="editor-enemy-stat-section">
        <div className="editor-family__header">
          <h3>Progression</h3>
        </div>
        <label className="editor-field">
          <span>Academic Title</span>
          <input
            disabled={draft.isSaving}
            onChange={(event) =>
              draft.updateSelectedEnemy((current) =>
                updateEnemyProgression(current, {
                  academicTitle: event.target.value,
                }),
              )
            }
            type="text"
            value={enemy.stats.progression.academicTitle}
          />
        </label>
        <label className="editor-field">
          <span>Academic Progress</span>
          <input
            disabled={draft.isSaving}
            onChange={(event) =>
              draft.updateSelectedEnemy((current) =>
                updateEnemyProgression(current, {
                  academicProgress: parseNumberInput(event.target.value),
                }),
              )
            }
            type="number"
            value={formatNumberInput(enemy.stats.progression.academicProgress)}
          />
        </label>
      </section>

      <EnemyLootEditor draft={draft} enemy={enemy} />

      <div className="editor-actions">
        <TerminalButton
          className="editor-action-button"
          disabled={!draft.canSaveSelectedEnemy}
          onClick={draft.saveSelectedEnemy}
        >
          Save Profile
        </TerminalButton>
        <TerminalButton
          className="editor-action-button"
          disabled={!draft.canResetSelectedEnemy}
          onClick={draft.resetSelectedEnemy}
        >
          Reset
        </TerminalButton>
      </div>
      <TerminalButton
        className="editor-action-button"
        disabled={!draft.canDeleteSelectedEnemy}
        onClick={draft.deleteSelectedEnemy}
      >
        Delete Profile
      </TerminalButton>

      <p
        aria-live="polite"
        className={`editor-save-status editor-save-status--${draft.saveStatus.state}`}
      >
        {draft.saveStatus.message}
      </p>
    </section>
  );
}

function EnemyStatSection({
  draft,
  enemy,
  section,
}: {
  draft: EnemyDraftController;
  enemy: EnemyDef;
  section: EnemyStatSectionConfig;
}) {
  const values = enemy.stats[section.section] as unknown as Record<
    string,
    number
  >;

  return (
    <section className="editor-enemy-stat-section">
      <div className="editor-family__header">
        <h3>{section.label}</h3>
      </div>
      <div className="editor-enemy-stat-grid">
        {section.fields.map((field) => (
          <label className="editor-field" key={field}>
            <span>{formatStatLabel(field)}</span>
            <input
              disabled={draft.isSaving}
              onChange={(event) =>
                draft.updateSelectedEnemy((current) =>
                  updateEnemyStatValue(
                    current,
                    section.section,
                    field,
                    parseNumberInput(event.target.value),
                  ),
                )
              }
              type="number"
              value={formatNumberInput(values[field])}
            />
          </label>
        ))}
      </div>
    </section>
  );
}

function EnemyLootEditor({
  draft,
  enemy,
}: {
  draft: EnemyDraftController;
  enemy: EnemyDef;
}) {
  return (
    <section className="editor-zone-section">
      <div className="editor-family__header">
        <h3>Loot</h3>
        <span>{enemy.loot.length}</span>
      </div>
      {enemy.loot.length === 0 ? (
        <p className="editor-empty">No loot.</p>
      ) : (
        <ul className="editor-zone-row-list">
          {enemy.loot.map((entry, index) => (
            <li className="editor-zone-row" key={`${entry.itemId}-${index}`}>
              <div className="editor-form-row">
                <label className="editor-field">
                  <span>Item</span>
                  <select
                    disabled={draft.isSaving}
                    onChange={(event) =>
                      draft.updateSelectedEnemy((current) =>
                        updateEnemyLootEntry(current, index, {
                          itemId: event.target.value,
                        }),
                      )
                    }
                    value={entry.itemId}
                  >
                    {itemOptions(draft.itemIds, entry.itemId).map((itemId) => (
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
                      draft.updateSelectedEnemy((current) =>
                        updateEnemyLootEntry(current, index, {
                          quantity: parseNumberInput(event.target.value),
                        }),
                      )
                    }
                    step={1}
                    type="number"
                    value={formatNumberInput(entry.quantity)}
                  />
                </label>
              </div>
              <TerminalButton
                className="editor-compact-button"
                disabled={draft.isSaving}
                onClick={() =>
                  draft.updateSelectedEnemy((current) =>
                    removeEnemyLootEntry(current, index),
                  )
                }
              >
                Remove Loot
              </TerminalButton>
            </li>
          ))}
        </ul>
      )}
      <TerminalButton
        className="editor-compact-button"
        disabled={draft.isSaving || draft.itemIds.length === 0}
        onClick={() =>
          draft.updateSelectedEnemy((current) =>
            addEnemyLootEntry(current, draft.itemIds[0] ?? ""),
          )
        }
      >
        Add Loot
      </TerminalButton>
    </section>
  );
}

function BalanceHint() {
  return (
    <section className="editor-enemy-balance-hint">
      <h3>Balance Targets</h3>
      <p>
        Tutorial fights: 2-4 strong attacks. First threats: 4-7. Later danger:
        6-10. Favor one clear strength before adding HP.
      </p>
    </section>
  );
}

function itemOptions(
  itemIds: readonly string[],
  currentItemId: string,
): string[] {
  return [...new Set([currentItemId, ...itemIds].filter(Boolean))];
}

function parseNumberInput(value: string): number {
  return value.trim() ? Number(value) : Number.NaN;
}

function formatNumberInput(value: number): string {
  return Number.isFinite(value) ? String(value) : "";
}

function formatStatLabel(value: string): string {
  const spaced = value.replace(/([A-Z])/g, " $1").toLowerCase();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}
