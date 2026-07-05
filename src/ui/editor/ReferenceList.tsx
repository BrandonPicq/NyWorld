import type { ContentRef, ContentReference } from "../../engine";
import { formatContentRef } from "./editorModel";

export function ReferenceList({
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
