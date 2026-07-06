import {
  formatContentDiagnostic,
  type ContentReference,
  type NpcPresenceDef,
} from "../../../engine";
import { IdentifierLabel } from "../../components/IdentifierLabel";
import { ScrollRegion } from "../../components/ScrollRegion";
import { TerminalButton } from "../../components/TerminalButton";
import { TerminalPanel } from "../../components/TerminalPanel";
import { formatContentRef } from "../editorModel";
import { ScheduleEntriesEditor } from "../ScheduleEntriesEditor";
import type { NpcPresenceDraftController } from "./useNpcPresenceDraft";

type PresenceTabProps = {
  draft: NpcPresenceDraftController;
};

export function PresenceTab({ draft }: PresenceTabProps) {
  const presenceCount = draft.npcs.filter((npc) => npc.hasPresence).length;

  return (
    <>
      <section className="editor-summary" aria-label="Presence summary">
        <span>{draft.npcs.length} NPCs</span>
        <span>{presenceCount} with presence</span>
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
                      {npc.hasPresence
                        ? `${npc.entryCount} entr${npc.entryCount === 1 ? "y" : "ies"}`
                        : "no presence"}
                    </span>
                  </span>
                </TerminalButton>
              ))}
            </div>
          </TerminalPanel>
        </ScrollRegion>

        <ScrollRegion className="workbench__main">
          <TerminalPanel className="editor-panel editor-enemy-editor">
            <h2 className="editor-panel__title">Presence</h2>
            {draft.selectedNpc ? (
              draft.selectedPresence ? (
                <PresenceForm
                  draft={draft}
                  presence={draft.selectedPresence}
                />
              ) : (
                <CreatePresence draft={draft} />
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
                <h3>Selected Presence</h3>
                <span>{draft.selectedPresenceDiagnostics.length}</span>
              </div>
              {draft.selectedPresenceDiagnostics.length === 0 ? (
                <p className="editor-empty">No problems.</p>
              ) : (
                <ul className="editor-diagnostic-list">
                  {draft.selectedPresenceDiagnostics.map((diagnostic, index) => (
                    <li
                      className={`editor-diagnostic editor-diagnostic--${diagnostic.severity}`}
                      key={`${diagnostic.contentId ?? "presence"}-${diagnostic.path}-${index}`}
                    >
                      {formatContentDiagnostic(diagnostic)}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <PresenceReferences
              references={draft.selectedPresenceReferences}
              title="Incoming References"
            />
          </TerminalPanel>
        </ScrollRegion>
      </div>
    </>
  );
}

function CreatePresence({ draft }: { draft: NpcPresenceDraftController }) {
  return (
    <section className="editor-item-form" aria-label="Presence creator">
      <div className="editor-family__header">
        <h3>{draft.selectedNpc?.name ?? draft.selectedNpcId}</h3>
        <span>no presence</span>
      </div>
      <p className="editor-empty">
        This NPC has no global presence. Create one to give it a daily schedule.
      </p>
      <TerminalButton
        className="editor-action-button"
        disabled={!draft.canCreateSelectedPresence}
        onClick={draft.createSelectedPresence}
      >
        Create Presence
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

function PresenceForm({
  draft,
  presence,
}: {
  draft: NpcPresenceDraftController;
  presence: NpcPresenceDef;
}) {
  return (
    <section className="editor-item-form" aria-label="Presence editor">
      <div className="editor-family__header">
        <h3>{draft.selectedNpc?.name ?? presence.npcId}</h3>
        <span>
          {draft.selectedPresenceHasUnsavedChanges ? "dirty" : "clean"}
        </span>
      </div>

      <label className="editor-field">
        <span>NPC Id</span>
        <input disabled readOnly type="text" value={presence.npcId} />
      </label>

      <ScheduleEntriesEditor
        dialogueIds={draft.dialogueIds}
        emptyLabel="No schedule entries (a presence needs at least one)."
        entries={presence.schedule}
        onAdd={draft.addScheduleEntry}
        onRemove={draft.removeScheduleEntry}
        onUpdate={draft.updateScheduleEntry}
        title="Schedule"
        zoneIds={draft.zoneIds}
        zonePlaceholderLabel="(select a zone)"
      />

      <div className="editor-actions">
        <TerminalButton
          className="editor-action-button"
          disabled={!draft.canSaveSelectedPresence}
          onClick={draft.saveSelectedPresence}
        >
          Save Presence
        </TerminalButton>
        <TerminalButton
          className="editor-action-button"
          disabled={!draft.canResetSelectedPresence}
          onClick={draft.resetSelectedPresence}
        >
          Reset
        </TerminalButton>
      </div>
      <TerminalButton
        className="editor-action-button"
        disabled={!draft.canDeleteSelectedPresence}
        onClick={draft.deleteSelectedPresence}
      >
        Delete Presence
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

function PresenceReferences({
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
