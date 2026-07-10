import { useState } from "react";
import {
  formatContentDiagnostic,
  NPC_IMPORTANCE_OPTIONS,
  NPC_RACE_OPTIONS,
  type NpcDef,
  type NpcImportance,
  type NpcRace,
} from "../../../engine";
import { IdentifierLabel } from "../../components/IdentifierLabel";
import { ScrollRegion } from "../../components/ScrollRegion";
import { EditorButton } from "../components/EditorButton";
import { EditorPanel } from "../components/EditorPanel";
import type { EditorContentNavigationTarget } from "../DiagnosticList";
import { EditorGroupedList } from "../EditorGroupedList";
import { ReferenceList } from "../ReferenceList";
import type { NpcDraftController } from "./useNpcDraft";

type NpcTabProps = {
  draft: NpcDraftController;
  onNavigate: (target: EditorContentNavigationTarget) => void;
};

export function NpcTab({ draft, onNavigate }: NpcTabProps) {
  const [listFilter, setListFilter] = useState("");

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
          <EditorPanel className="editor-panel editor-npc-list">
            <h2 className="editor-panel__title">NPCs</h2>
            <EditorGroupedList
              emptyLabel="No matching NPCs."
              filter={listFilter}
              groups={[{
                key: "npcs",
                label: "NPCs",
                entries: draft.npcs.map((npc) => ({
                  key: npc.npcId,
                  id: npc.npcId,
                  name: npc.name,
                  label: <IdentifierLabel value={npc.npcId} />,
                  meta: npc.name,
                  isUnsaved: npc.hasUnsavedChanges,
                })),
              }]}
              onFilterChange={setListFilter}
              onSelect={(entry) => draft.selectNpc(entry.id)}
              selectedEntryKey={draft.selectedNpcId}
            />

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
                <EditorButton
                  className="editor-action-button"
                  disabled={!draft.canCreateNpcDraft}
                  onClick={draft.createNpcDraft}
                >
                  Create Draft
                </EditorButton>
                <EditorButton
                  className="editor-action-button"
                  disabled={!draft.canCreateNpcWithDefaultDialogue}
                  onClick={draft.createNpcWithDefaultDialogue}
                >
                  Create + Dialogue
                </EditorButton>
              </div>
            </section>
          </EditorPanel>
        </ScrollRegion>

        <ScrollRegion className="workbench__main">
          <EditorPanel className="editor-panel editor-npc-editor">
            <h2 className="editor-panel__title">Sheet</h2>
            {draft.selectedNpc ? (
              <NpcSheetForm draft={draft} npc={draft.selectedNpc} />
            ) : (
              <p className="editor-empty">No NPC selected.</p>
            )}
          </EditorPanel>
        </ScrollRegion>

        <ScrollRegion className="workbench__inspector">
          <EditorPanel className="editor-panel editor-npc-problems">
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

            <ReferenceList
              emptyLabel="No incoming references."
              onNavigate={onNavigate}
              references={draft.selectedNpcReferences}
              title="Incoming References"
              useTarget={false}
            />
          </EditorPanel>
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

      <div className="editor-form-row">
        <label className="editor-field">
          <span>RPG Class</span>
          <select
            disabled={draft.isSaving}
            onChange={(event) =>
              draft.updateSelectedNpc((current) => ({
                ...current,
                classId: event.target.value || undefined,
              }))
            }
            value={npc.classId ?? ""}
          >
            <option value="">none</option>
            {draft.classIds.map((classId) => (
              <option key={classId} value={classId}>
                {classId}
              </option>
            ))}
          </select>
        </label>

        <label className="editor-field">
          <span>RPG Race</span>
          <select
            disabled={draft.isSaving}
            onChange={(event) =>
              draft.updateSelectedNpc((current) => ({
                ...current,
                raceId: event.target.value || undefined,
              }))
            }
            value={npc.raceId ?? ""}
          >
            <option value="">none</option>
            {draft.raceIds.map((raceId) => (
              <option key={raceId} value={raceId}>
                {raceId}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="editor-field">
        <span>RPG Level</span>
        <input
          disabled={draft.isSaving}
          min={1}
          onChange={(event) =>
            draft.updateSelectedNpc((current) => ({
              ...current,
              level: event.target.value ? Number(event.target.value) : undefined,
            }))
          }
          type="number"
          value={npc.level ?? ""}
        />
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
        <EditorButton
          className="editor-action-button"
          disabled={!draft.canSaveSelectedNpc}
          onClick={draft.saveSelectedNpc}
        >
          Save NPC
        </EditorButton>
        <EditorButton
          className="editor-action-button"
          disabled={!draft.selectedNpcHasUnsavedChanges || draft.isSaving}
          onClick={draft.resetSelectedNpc}
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

function defaultGlyph(npc: NpcDef): string {
  return npc.name.trim().charAt(0) || "?";
}

function toColorInputValue(value: string | undefined): string {
  return value && /^#[0-9a-fA-F]{6}$/.test(value) ? value : "#ffb000";
}
