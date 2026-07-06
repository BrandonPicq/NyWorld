import {
  formatContentDiagnostic,
  NPC_IMPORTANCE_OPTIONS,
  NPC_RACE_OPTIONS,
  type ContentReference,
  type NpcDef,
  type NpcImportance,
  type NpcRace,
} from "../../../engine";
import { IdentifierLabel } from "../../components/IdentifierLabel";
import { ScrollRegion } from "../../components/ScrollRegion";
import { TerminalButton } from "../../components/TerminalButton";
import { TerminalPanel } from "../../components/TerminalPanel";
import { formatContentRef } from "../editorModel";
import type { NpcDraftController } from "./useNpcDraft";

type NpcTabProps = {
  draft: NpcDraftController;
};

export function NpcTab({ draft }: NpcTabProps) {
  return (
    <>
      <section className="editor-summary" aria-label="NPC summary">
        <span>{draft.npcs.length} NPCs</span>
        <span>{draft.errorCount} errors</span>
        <span>{draft.warningCount} warnings</span>
        <span>{draft.hasUnsavedChanges ? "unsaved" : "saved"}</span>
      </section>

      <div className="workbench">
        <ScrollRegion className="workbench__rail">
          <TerminalPanel className="editor-panel editor-npc-list">
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
                      {npc.name}
                    </span>
                  </span>
                </TerminalButton>
              ))}
            </div>

            <section className="editor-zone-create">
              <h3 className="editor-panel__title">New NPC</h3>
              <label className="editor-field">
                <span>NPC Id</span>
                <input
                  disabled={draft.isSaving}
                  onChange={(event) =>
                    draft.setNewNpcIdDraft(event.target.value)
                  }
                  type="text"
                  value={draft.newNpcIdDraft}
                />
              </label>
              <label className="editor-field">
                <span>Name</span>
                <input
                  disabled={draft.isSaving}
                  onChange={(event) =>
                    draft.setNewNpcNameDraft(event.target.value)
                  }
                  type="text"
                  value={draft.newNpcNameDraft}
                />
              </label>
              {draft.newNpcIdDraft.trim() && draft.newNpcIdErrors.length > 0 ? (
                <InlineProblems problems={draft.newNpcIdErrors} />
              ) : null}
              <label className="editor-field">
                <span>Default Dialogue</span>
                <select
                  disabled={draft.isSaving || draft.dialogueIds.length === 0}
                  onChange={(event) =>
                    draft.setNewNpcDialogueIdDraft(event.target.value)
                  }
                  value={draft.newNpcDialogueIdDraft}
                >
                  {draft.dialogueIds.map((dialogueId) => (
                    <option key={dialogueId} value={dialogueId}>
                      {dialogueId}
                    </option>
                  ))}
                </select>
              </label>
              <div className="editor-actions">
                <TerminalButton
                  className="editor-action-button"
                  disabled={!draft.canCreateNpcDraft}
                  onClick={draft.createNpcDraft}
                >
                  Create Draft
                </TerminalButton>
                <TerminalButton
                  className="editor-action-button"
                  disabled={!draft.canCreateNpcWithDefaultDialogue}
                  onClick={draft.createNpcWithDefaultDialogue}
                >
                  Create + Dialogue
                </TerminalButton>
              </div>
            </section>
          </TerminalPanel>
        </ScrollRegion>

        <ScrollRegion className="workbench__main">
          <TerminalPanel className="editor-panel editor-npc-editor">
            <h2 className="editor-panel__title">Sheet</h2>
            {draft.selectedNpc ? (
              <NpcSheetForm draft={draft} npc={draft.selectedNpc} />
            ) : (
              <p className="editor-empty">No NPC selected.</p>
            )}
          </TerminalPanel>
        </ScrollRegion>

        <ScrollRegion className="workbench__inspector">
          <TerminalPanel className="editor-panel editor-npc-problems">
            <h2 className="editor-panel__title">Problems</h2>
            <section className="editor-zone-section">
              <div className="editor-family__header">
                <h3>Selected NPC</h3>
                <span>{draft.selectedNpcDiagnostics.length}</span>
              </div>
              {draft.selectedNpcDiagnostics.length === 0 ? (
                <p className="editor-empty">No problems.</p>
              ) : (
                <ul className="editor-diagnostic-list">
                  {draft.selectedNpcDiagnostics.map((diagnostic, index) => (
                    <li
                      className={`editor-diagnostic editor-diagnostic--${diagnostic.severity}`}
                      key={`${diagnostic.contentId ?? "npc"}-${diagnostic.path}-${index}`}
                    >
                      {formatContentDiagnostic(diagnostic)}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <NpcReferences
              references={draft.selectedNpcReferences}
              title="Incoming References"
            />
          </TerminalPanel>
        </ScrollRegion>
      </div>
    </>
  );
}

function NpcSheetForm({
  draft,
  npc,
}: {
  draft: NpcDraftController;
  npc: NpcDef;
}) {
  const hasPresentation = npc.presentation !== undefined;

  return (
    <section className="editor-item-form" aria-label="NPC sheet editor">
      <div className="editor-family__header">
        <h3>{npc.name || npc.npcId}</h3>
        <span>{draft.selectedNpcHasUnsavedChanges ? "dirty" : "clean"}</span>
      </div>

      <label className="editor-field">
        <span>NPC Id</span>
        <input disabled readOnly type="text" value={npc.npcId} />
      </label>

      <label className="editor-field">
        <span>Name</span>
        <input
          disabled={draft.isSaving}
          onChange={(event) =>
            draft.updateSelectedNpc((current) => ({
              ...current,
              name: event.target.value,
            }))
          }
          type="text"
          value={npc.name}
        />
      </label>

      <div className="editor-form-row">
        <label className="editor-field">
          <span>Race</span>
          <select
            disabled={draft.isSaving}
            onChange={(event) =>
              draft.updateSelectedNpc((current) => ({
                ...current,
                race: event.target.value as NpcRace,
              }))
            }
            value={npc.race}
          >
            {NPC_RACE_OPTIONS.map((race) => (
              <option key={race} value={race}>
                {race}
              </option>
            ))}
          </select>
        </label>

        <label className="editor-field">
          <span>Importance</span>
          <select
            disabled={draft.isSaving}
            onChange={(event) =>
              draft.updateSelectedNpc((current) => ({
                ...current,
                importance: event.target.value
                  ? (event.target.value as NpcImportance)
                  : undefined,
              }))
            }
            value={npc.importance ?? ""}
          >
            <option value="">default common</option>
            {NPC_IMPORTANCE_OPTIONS.map((importance) => (
              <option key={importance} value={importance}>
                {importance}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="editor-field">
        <span>Default Dialogue</span>
        <select
          disabled={draft.isSaving}
          onChange={(event) =>
            draft.updateSelectedNpc((current) => ({
              ...current,
              defaultDialogueId: event.target.value,
            }))
          }
          value={npc.defaultDialogueId}
        >
          {draft.dialogueIds.map((dialogueId) => (
            <option key={dialogueId} value={dialogueId}>
              {dialogueId}
            </option>
          ))}
        </select>
      </label>

      <label className="editor-checkbox-field">
        <input
          checked={hasPresentation}
          disabled={draft.isSaving}
          onChange={(event) =>
            draft.updateSelectedNpc((current) => ({
              ...current,
              presentation: event.target.checked
                ? {
                    glyph: current.presentation?.glyph ?? defaultGlyph(current),
                    color: current.presentation?.color ?? "#ffb000",
                  }
                : undefined,
            }))
          }
          type="checkbox"
        />
        <span>Custom Presentation</span>
      </label>

      {hasPresentation ? (
        <div className="editor-form-row">
          <label className="editor-field">
            <span>Glyph</span>
            <input
              disabled={draft.isSaving}
              maxLength={1}
              onChange={(event) =>
                draft.updateSelectedNpc((current) => ({
                  ...current,
                  presentation: {
                    glyph: event.target.value,
                    color: current.presentation?.color ?? "#ffb000",
                  },
                }))
              }
              type="text"
              value={npc.presentation?.glyph ?? ""}
            />
          </label>

          <label className="editor-field">
            <span>Color</span>
            <span className="editor-color-control">
              <input
                aria-label="Presentation color swatch"
                disabled={draft.isSaving}
                onChange={(event) =>
                  draft.updateSelectedNpc((current) => ({
                    ...current,
                    presentation: {
                      glyph:
                        current.presentation?.glyph ?? defaultGlyph(current),
                      color: event.target.value,
                    },
                  }))
                }
                type="color"
                value={toColorInputValue(npc.presentation?.color)}
              />
              <input
                disabled={draft.isSaving}
                onChange={(event) =>
                  draft.updateSelectedNpc((current) => ({
                    ...current,
                    presentation: {
                      glyph:
                        current.presentation?.glyph ?? defaultGlyph(current),
                      color: event.target.value,
                    },
                  }))
                }
                type="text"
                value={npc.presentation?.color ?? ""}
              />
            </span>
          </label>
        </div>
      ) : null}

      <div className="editor-actions">
        <TerminalButton
          className="editor-action-button"
          disabled={!draft.canSaveSelectedNpc}
          onClick={draft.saveSelectedNpc}
        >
          Save NPC
        </TerminalButton>
        <TerminalButton
          className="editor-action-button"
          disabled={!draft.selectedNpcHasUnsavedChanges || draft.isSaving}
          onClick={draft.resetSelectedNpc}
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

function InlineProblems({ problems }: { problems: string[] }) {
  return (
    <ul className="editor-inline-diagnostics">
      {problems.map((problem) => (
        <li className="editor-diagnostic editor-diagnostic--error" key={problem}>
          {problem}
        </li>
      ))}
    </ul>
  );
}

function NpcReferences({
  references,
  title,
}: {
  references: ContentReference[];
  title: string;
}) {
  return (
    <section className="editor-reference-list">
      <h3>{title}</h3>
      {references.length === 0 ? (
        <p className="editor-empty">No incoming references.</p>
      ) : (
        <ul>
          {references.map((reference, index) => (
            <li key={`${reference.from.type}-${reference.from.id}-${index}`}>
              <span>{formatContentRef(reference.from)}</span>
              <strong>{reference.path}</strong>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function defaultGlyph(npc: NpcDef): string {
  return npc.name.trim().charAt(0) || "?";
}

function toColorInputValue(value: string | undefined): string {
  return value && /^#[0-9a-fA-F]{6}$/.test(value) ? value : "#ffb000";
}
