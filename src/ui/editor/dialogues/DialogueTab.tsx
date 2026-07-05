import {
  formatContentDiagnostic,
  type ContentReference,
} from "../../../engine";
import { IdentifierLabel } from "../../components/IdentifierLabel";
import { ScrollRegion } from "../../components/ScrollRegion";
import { TerminalButton } from "../../components/TerminalButton";
import { TerminalPanel } from "../../components/TerminalPanel";
import { DialogueNodesEditor } from "../DialogueNodesEditor";
import { formatContentRef } from "../editorModel";
import {
  addDialogueNode,
  removeDialogueNode,
  updateDialogueNode,
} from "./dialogueEditorModel";
import type { DialogueDraftController } from "./useDialogueDraft";

type DialogueTabProps = {
  draft: DialogueDraftController;
};

export function DialogueTab({ draft }: DialogueTabProps) {
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

      <div className="editor-dialogue-layout">
        <TerminalPanel className="editor-panel editor-dialogue-files">
          <h2 className="editor-panel__title">Files</h2>
          <ScrollRegion className="editor-scroll">
            <div className="editor-entry-list">
              {draft.files.map((file) => (
                <TerminalButton
                  className="editor-entry-button"
                  isSelected={file.stem === draft.selectedStem}
                  key={file.stem}
                  onClick={() => draft.selectFile(file.stem)}
                >
                  <span className="editor-zone-entry">
                    <span className="editor-zone-entry__name">
                      <IdentifierLabel value={file.stem} />
                      {file.hasUnsavedChanges ? " *" : ""}
                    </span>
                    <span className="editor-zone-entry__meta">
                      {file.dialogueCount} dialogues
                    </span>
                  </span>
                </TerminalButton>
              ))}
            </div>

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
              <TerminalButton
                className="editor-action-button"
                disabled={draft.newFileStemErrors.length > 0}
                onClick={draft.createDialogueFile}
              >
                Create File
              </TerminalButton>
            </section>
          </ScrollRegion>
        </TerminalPanel>

        <TerminalPanel className="editor-panel editor-dialogue-editor">
          <h2 className="editor-panel__title">Dialogues</h2>
          <ScrollRegion className="editor-scroll">
            {draft.selectedFile ? (
              <>
                <section className="editor-zone-section">
                  <div className="editor-family__header">
                    <h3>{draft.selectedStem}</h3>
                    <span>{draft.dialogueIds.length}</span>
                  </div>
                  {draft.dialogueIds.length === 0 ? (
                    <p className="editor-empty">No dialogues.</p>
                  ) : (
                    <div className="editor-entry-list">
                      {draft.dialogueIds.map((dialogueId) => (
                        <TerminalButton
                          className="editor-entry-button"
                          isSelected={dialogueId === draft.selectedDialogueId}
                          key={dialogueId}
                          onClick={() => draft.selectDialogue(dialogueId)}
                        >
                          <IdentifierLabel value={dialogueId} />
                        </TerminalButton>
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
                  <TerminalButton
                    className="editor-action-button"
                    disabled={
                      !draft.selectedFile ||
                      draft.newDialogueIdErrors.length > 0
                    }
                    onClick={draft.addDialogueToSelectedFile}
                  >
                    Add Dialogue
                  </TerminalButton>
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
                    <TerminalButton
                      className="editor-action-button"
                      disabled={!draft.canSaveSelectedFile}
                      onClick={draft.saveSelectedFile}
                    >
                      Save File
                    </TerminalButton>
                    <TerminalButton
                      className="editor-action-button"
                      disabled={
                        !draft.selectedFileHasUnsavedChanges || draft.isSaving
                      }
                      onClick={draft.resetSelectedFile}
                    >
                      Reset File
                    </TerminalButton>
                  </div>
                  <TerminalButton
                    className="editor-action-button"
                    disabled={
                      !draft.selectedDialogueId ||
                      !draft.canDeleteSelectedDialogue
                    }
                    onClick={draft.deleteSelectedDialogue}
                  >
                    Delete Dialogue
                  </TerminalButton>
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
          </ScrollRegion>
        </TerminalPanel>

        <TerminalPanel className="editor-panel editor-dialogue-problems">
          <h2 className="editor-panel__title">Problems</h2>
          <ScrollRegion className="editor-scroll">
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

            <DialogueReferences
              references={draft.selectedDialogueReferences}
              title="Incoming References"
            />
          </ScrollRegion>
        </TerminalPanel>
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

function DialogueReferences({
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
