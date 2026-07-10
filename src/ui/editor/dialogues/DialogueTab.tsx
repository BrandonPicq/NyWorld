import { useState } from "react";
import {
  formatContentDiagnostic,
} from "../../../engine";
import { IdentifierLabel } from "../../components/IdentifierLabel";
import { ScrollRegion } from "../../components/ScrollRegion";
import { EditorButton } from "../components/EditorButton";
import { EditorPanel } from "../components/EditorPanel";
import { DialogueNodesEditor } from "../DialogueNodesEditor";
import { EditorGroupedList } from "../EditorGroupedList";
import type { EditorContentNavigationTarget } from "../DiagnosticList";
import { ListFilterField } from "../ListFilterField";
import { filterByIdOrName } from "../listFilter";
import { ReferenceList } from "../ReferenceList";
import {
  addDialogueNode,
  removeDialogueNode,
  updateDialogueNode,
} from "./dialogueEditorModel";
import type { DialogueDraftController } from "./useDialogueDraft";

type DialogueTabProps = {
  draft: DialogueDraftController;
  onNavigate: (target: EditorContentNavigationTarget) => void;
};

export function DialogueTab({ draft, onNavigate }: DialogueTabProps) {
  const [fileFilter, setFileFilter] = useState("");
  const [dialogueFilter, setDialogueFilter] = useState("");
  const filteredDialogueIds = filterByIdOrName(
    draft.dialogueIds.map((dialogueId) => ({ id: dialogueId })),
    dialogueFilter,
  ).map((entry) => entry.id);

  return (
    <>
      <section className="editor-summary" aria-label="Dialogue summary">
        <span>{draft.files.length} files</span>
        <span>
          {draft.files.reduce((sum, file) => sum + file.dialogueCount, 0)}{" "}
          dialogues
        </span>
        <span>{draft.errorCount} errors</span>
        <span>{draft.warningCount} warnings</span>
        <span>{draft.hasUnsavedChanges ? "unsaved" : "saved"}</span>
      </section>

      <div className="workbench">
        <ScrollRegion className="workbench__rail">
          <EditorPanel className="editor-panel editor-dialogue-files">
            <h2 className="editor-panel__title">Files</h2>
            <EditorGroupedList
              emptyLabel="No matching files."
              filter={fileFilter}
              groups={[
                {
                  key: "files",
                  label: "Files",
                  entries: draft.files.map((file) => ({
                    key: file.stem,
                    id: file.stem,
                    label: <IdentifierLabel value={file.stem} />,
                    meta: `${file.dialogueCount} dialogues`,
                    isUnsaved: file.hasUnsavedChanges,
                  })),
                },
              ]}
              onFilterChange={setFileFilter}
              onSelect={(entry) => draft.selectFile(entry.id)}
              selectedEntryKey={draft.selectedStem}
            />

            <section className="editor-zone-create">
              <h3 className="editor-panel__title">New File</h3>
              <label className="editor-field">
                <span>Stem</span>
                <input
                  onChange={(event) =>
                    draft.setNewFileStemDraft(event.target.value)
                  }
                  type="text"
                  value={draft.newFileStemDraft}
                />
              </label>
              {draft.newFileStemDraft.trim() &&
              draft.newFileStemErrors.length > 0 ? (
                <InlineProblems problems={draft.newFileStemErrors} />
              ) : null}
              <EditorButton
                className="editor-action-button"
                disabled={draft.newFileStemErrors.length > 0}
                onClick={draft.createDialogueFile}
              >
                Create File
              </EditorButton>
            </section>
          </EditorPanel>
        </ScrollRegion>

        <ScrollRegion className="workbench__main">
          <EditorPanel className="editor-panel editor-dialogue-editor">
            <h2 className="editor-panel__title">Dialogues</h2>
            {draft.selectedFile ? (
              <>
                <section className="editor-zone-section">
                  <div className="editor-family__header">
                    <h3>{draft.selectedStem}</h3>
                    <span>{draft.dialogueIds.length}</span>
                  </div>
                  <ListFilterField
                    label="Search"
                    onChange={setDialogueFilter}
                    value={dialogueFilter}
                  />
                  {draft.dialogueIds.length === 0 ? (
                    <p className="editor-empty">No dialogues.</p>
                  ) : filteredDialogueIds.length === 0 ? (
                    <p className="editor-empty">No matching dialogues.</p>
                  ) : (
                    <div className="editor-entry-list">
                      {filteredDialogueIds.map((dialogueId) => (
                        <EditorButton
                          className="editor-entry-button"
                          isSelected={dialogueId === draft.selectedDialogueId}
                          key={dialogueId}
                          onClick={() => draft.selectDialogue(dialogueId)}
                        >
                          <IdentifierLabel value={dialogueId} />
                        </EditorButton>
                      ))}
                    </div>
                  )}
                </section>

                <section className="editor-zone-create">
                  <h3 className="editor-panel__title">New Dialogue</h3>
                  <label className="editor-field">
                    <span>Dialogue Id</span>
                    <input
                      onChange={(event) =>
                        draft.setNewDialogueIdDraft(event.target.value)
                      }
                      type="text"
                      value={draft.newDialogueIdDraft}
                    />
                  </label>
                  {draft.newDialogueIdDraft.trim() &&
                  draft.newDialogueIdErrors.length > 0 ? (
                    <InlineProblems problems={draft.newDialogueIdErrors} />
                  ) : null}
                  <EditorButton
                    className="editor-action-button"
                    disabled={
                      !draft.selectedFile ||
                      draft.newDialogueIdErrors.length > 0
                    }
                    onClick={draft.addDialogueToSelectedFile}
                  >
                    Add Dialogue
                  </EditorButton>
                </section>

                {draft.selectedDialogueId ? (
                  <DialogueNodesEditor
                    emptyLabel="No dialogue lines."
                    nodes={draft.selectedDialogueNodes}
                    onAddNode={() =>
                      draft.updateSelectedDialogueNodes(addDialogueNode)
                    }
                    onRemoveNode={(index) =>
                      draft.updateSelectedDialogueNodes((nodes) =>
                        removeDialogueNode(nodes, index),
                      )
                    }
                    onUpdateNode={(index, patch) =>
                      draft.updateSelectedDialogueNodes((nodes) =>
                        updateDialogueNode(nodes, index, patch),
                      )
                    }
                    title={draft.selectedDialogueId}
                  />
                ) : null}

                <section className="editor-zone-section">
                  <div className="editor-actions">
                    <EditorButton
                      className="editor-action-button"
                      disabled={!draft.canSaveSelectedFile}
                      onClick={draft.saveSelectedFile}
                    >
                      Save File
                    </EditorButton>
                    <EditorButton
                      className="editor-action-button"
                      disabled={
                        !draft.selectedFileHasUnsavedChanges || draft.isSaving
                      }
                      onClick={draft.resetSelectedFile}
                    >
                      Reset File
                    </EditorButton>
                  </div>
                  <EditorButton
                    className="editor-action-button"
                    disabled={
                      !draft.selectedDialogueId ||
                      !draft.canDeleteSelectedDialogue
                    }
                    onClick={draft.deleteSelectedDialogue}
                  >
                    Delete Dialogue
                  </EditorButton>
                  <p
                    aria-live="polite"
                    className={`editor-save-status editor-save-status--${draft.saveStatus.state}`}
                  >
                    {draft.saveStatus.message}
                  </p>
                </section>
              </>
            ) : (
              <p className="editor-empty">No dialogue file selected.</p>
            )}
          </EditorPanel>
        </ScrollRegion>

        <ScrollRegion className="workbench__inspector">
          <EditorPanel className="editor-panel editor-dialogue-problems">
            <h2 className="editor-panel__title">Problems</h2>
            <section className="editor-zone-section">
              <div className="editor-family__header">
                <h3>Selected File</h3>
                <span>{draft.selectedFileDiagnostics.length}</span>
              </div>
              {draft.selectedFileDiagnostics.length === 0 ? (
                <p className="editor-empty">No problems.</p>
              ) : (
                <ul className="editor-diagnostic-list">
                  {draft.selectedFileDiagnostics.map((diagnostic, index) => (
                    <li
                      className={`editor-diagnostic editor-diagnostic--${diagnostic.severity}`}
                      key={`${diagnostic.contentId ?? "file"}-${diagnostic.path}-${index}`}
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
              references={draft.selectedDialogueReferences}
              title="Incoming References"
              useTarget={false}
            />
          </EditorPanel>
        </ScrollRegion>
      </div>
    </>
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
