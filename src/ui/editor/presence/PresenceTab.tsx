import { useState } from "react";
import {
  formatContentDiagnostic,
  type ContentCatalogSnapshot,
  type NpcPresenceDef,
} from "../../../engine";
import type { GridCell } from "../../../rendering/canvasCellMapping";
import { IdentifierLabel } from "../../components/IdentifierLabel";
import { ScrollRegion } from "../../components/ScrollRegion";
import { TerminalButton } from "../../components/TerminalButton";
import { TerminalPanel } from "../../components/TerminalPanel";
import type { EditorContentNavigationTarget } from "../DiagnosticList";
import { MapCoordinatePicker } from "../MapCoordinatePicker";
import { ReferenceList } from "../ReferenceList";
import { ScheduleEntriesEditor } from "../ScheduleEntriesEditor";
import type { NpcPresenceDraftController } from "./useNpcPresenceDraft";

type PresenceTabProps = {
  draft: NpcPresenceDraftController;
  onNavigate: (target: EditorContentNavigationTarget) => void;
  snapshot: ContentCatalogSnapshot;
};

type CoordinatePickerRequest = {
  title: string;
  zoneId: string;
  onPick: (cell: GridCell) => void;
};

export function PresenceTab({
  draft,
  onNavigate,
  snapshot,
}: PresenceTabProps) {
  const [coordinatePicker, setCoordinatePicker] =
    useState<CoordinatePickerRequest | null>(null);
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
                  onPickCoordinate={setCoordinatePicker}
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

            <ReferenceList
              emptyLabel="No incoming references."
              onNavigate={onNavigate}
              references={draft.selectedPresenceReferences}
              title="Incoming References"
              useTarget={false}
            />
          </TerminalPanel>
        </ScrollRegion>
      </div>

      {coordinatePicker ? (
        <MapCoordinatePicker
          onClose={() => setCoordinatePicker(null)}
          onPick={coordinatePicker.onPick}
          snapshot={snapshot}
          title={coordinatePicker.title}
          zoneId={coordinatePicker.zoneId}
        />
      ) : null}
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
  onPickCoordinate,
  presence,
}: {
  draft: NpcPresenceDraftController;
  onPickCoordinate: (request: CoordinatePickerRequest) => void;
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
        onPickCoordinate={(index, zoneId) =>
          onPickCoordinate({
            title: `Pick presence coordinate for ${presence.npcId}`,
            zoneId,
            onPick: (cell) =>
              draft.updateScheduleEntry(index, { x: cell.x, y: cell.y }),
          })
        }
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
