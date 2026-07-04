import { useMemo, useState } from "react";
import {
  buildContentReferenceGraph,
  createRuntimeContentCatalogSnapshot,
  createRuntimeContentValidationContext,
  formatContentDiagnostic,
  validateAllContent,
  type ContentRef,
  type ContentReference,
} from "../../engine";
import { TerminalButton } from "../components/TerminalButton";
import { TerminalPanel } from "../components/TerminalPanel";
import {
  buildContentBrowserGroups,
  formatContentRef,
  groupDiagnosticsByContentType,
  refsEqual,
} from "./editorModel";

type ContentEditorScreenProps = {
  onBack: () => void;
};

export function ContentEditorScreen({ onBack }: ContentEditorScreenProps) {
  const { diagnostics, diagnosticGroups, graph, browserGroups } = useMemo(() => {
    const snapshot = createRuntimeContentCatalogSnapshot();
    const nextDiagnostics = validateAllContent(
      snapshot,
      createRuntimeContentValidationContext(),
    );

    return {
      diagnostics: nextDiagnostics,
      diagnosticGroups: groupDiagnosticsByContentType(nextDiagnostics),
      graph: buildContentReferenceGraph(snapshot),
      browserGroups: buildContentBrowserGroups(snapshot),
    };
  }, []);

  const firstRef = browserGroups[0]?.entries[0]?.ref ?? {
    type: "game",
    id: "game",
  };
  const [selectedRef, setSelectedRef] = useState<ContentRef>(firstRef);
  const selectedImpact = graph.getRenameImpact(selectedRef);
  const incomingRefs = graph.getReferencesTo(selectedRef);
  const outgoingRefs = graph.getReferencesFrom(selectedRef);
  const errorCount = diagnostics.filter(
    (diagnostic) => diagnostic.severity === "error",
  ).length;
  const warningCount = diagnostics.length - errorCount;
  const totalEntries = browserGroups.reduce(
    (sum, group) => sum + group.entries.length,
    0,
  );

  return (
    <main className="app-shell editor-screen" aria-labelledby="editor-heading">
      <div className="editor-shell">
        <header className="editor-header">
          <div>
            <p className="terminal-kicker">NYWARUDO // DEV CONTENT</p>
            <h1 className="terminal-heading-md" id="editor-heading">
              Content Editor
            </h1>
          </div>
          <TerminalButton className="editor-header__back" onClick={onBack}>
            Back
          </TerminalButton>
        </header>

        <section className="editor-summary" aria-label="Content summary">
          <span>{browserGroups.length} families</span>
          <span>{totalEntries} entries</span>
          <span>{errorCount} errors</span>
          <span>{warningCount} warnings</span>
        </section>

        <div className="editor-grid">
          <TerminalPanel className="editor-panel editor-browser">
            <h2 className="editor-panel__title">Content</h2>
            <div className="editor-scroll" role="list">
              {browserGroups.map((group) => (
                <section className="editor-family" key={group.type}>
                  <div className="editor-family__header">
                    <h3>{group.label}</h3>
                    <span>{group.entries.length}</span>
                  </div>
                  <div className="editor-entry-list">
                    {group.entries.map((entry) => (
                      <TerminalButton
                        className="editor-entry-button"
                        isSelected={refsEqual(entry.ref, selectedRef)}
                        key={`${entry.ref.type}:${entry.ref.id}`}
                        onClick={() => setSelectedRef(entry.ref)}
                      >
                        {entry.label}
                      </TerminalButton>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          </TerminalPanel>

          <TerminalPanel className="editor-panel editor-problems">
            <h2 className="editor-panel__title">Problems</h2>
            {diagnosticGroups.length === 0 ? (
              <p className="editor-empty">No content problems.</p>
            ) : (
              <div className="editor-scroll">
                {diagnosticGroups.map((group) => (
                  <section
                    className="editor-diagnostic-group"
                    key={group.contentType}
                  >
                    <div className="editor-family__header">
                      <h3>{group.contentType}</h3>
                      <span>
                        {group.errorCount}E / {group.warningCount}W
                      </span>
                    </div>
                    <ul className="editor-diagnostic-list">
                      {group.diagnostics.map((diagnostic, index) => (
                        <li
                          className={`editor-diagnostic editor-diagnostic--${diagnostic.severity}`}
                          key={`${group.contentType}-${diagnostic.path}-${index}`}
                        >
                          {formatContentDiagnostic(diagnostic)}
                        </li>
                      ))}
                    </ul>
                  </section>
                ))}
              </div>
            )}
          </TerminalPanel>

          <TerminalPanel className="editor-panel editor-reference">
            <h2 className="editor-panel__title">References</h2>
            <div className="editor-selected-ref">
              <span>{selectedRef.type}</span>
              <strong>{selectedRef.id}</strong>
            </div>

            <div className="editor-impact">
              <p>
                Rename impact: {selectedImpact.references.length} references
              </p>
              <p>
                Save persistence:{" "}
                {selectedImpact.appearsInSaves ? "yes" : "no"}
              </p>
            </div>

            <div className="editor-reference-columns">
              <ReferenceList
                emptyLabel="No incoming references."
                onSelectRef={setSelectedRef}
                references={incomingRefs}
                title="Incoming"
                useTarget={false}
              />
              <ReferenceList
                emptyLabel="No outgoing references."
                onSelectRef={setSelectedRef}
                references={outgoingRefs}
                title="Outgoing"
                useTarget
              />
            </div>
          </TerminalPanel>
        </div>
      </div>
    </main>
  );
}

function ReferenceList({
  emptyLabel,
  onSelectRef,
  references,
  title,
  useTarget,
}: {
  emptyLabel: string;
  onSelectRef: (ref: ContentRef) => void;
  references: ContentReference[];
  title: string;
  useTarget: boolean;
}) {
  return (
    <section className="editor-reference-list">
      <h3>{title}</h3>
      {references.length === 0 ? (
        <p className="editor-empty">{emptyLabel}</p>
      ) : (
        <ul>
          {references.map((reference, index) => {
            const linkedRef = useTarget ? reference.to : reference.from;
            return (
              <li key={`${reference.path}-${index}`}>
                <button
                  className="editor-reference-link"
                  onClick={() => onSelectRef(linkedRef)}
                  type="button"
                >
                  {formatContentRef(linkedRef)}
                </button>
                <span>{reference.path}</span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
