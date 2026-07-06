import type { ContentReference } from "../../engine";
import type { EditorContentNavigationTarget } from "./DiagnosticList";
import { formatContentRef } from "./editorModel";

export function ReferenceList({
  emptyLabel,
  onNavigate,
  references,
  title,
  useTarget,
}: {
  emptyLabel: string;
  onNavigate: (target: EditorContentNavigationTarget) => void;
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
                  onClick={() => onNavigate(linkedRef)}
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
