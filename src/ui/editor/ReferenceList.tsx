import { useEffect, useRef, useState, type KeyboardEvent } from "react";
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
  const [selectedIndex, setSelectedIndex] = useState(0);
  const buttonRefs = useRef<Array<HTMLButtonElement | null>>([]);

  useEffect(() => {
    if (selectedIndex >= references.length) {
      setSelectedIndex(Math.max(0, references.length - 1));
    }
  }, [references.length, selectedIndex]);

  function moveSelection(direction: -1 | 1): void {
    if (references.length === 0) {
      return;
    }
    const nextIndex =
      (selectedIndex + direction + references.length) % references.length;
    setSelectedIndex(nextIndex);
    requestAnimationFrame(() => buttonRefs.current[nextIndex]?.focus());
  }

  function navigateReference(index: number): void {
    const reference = references[index];
    if (!reference) {
      return;
    }
    onNavigate(useTarget ? reference.to : reference.from);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLElement>): void {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      event.stopPropagation();
      moveSelection(1);
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      event.stopPropagation();
      moveSelection(-1);
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      event.stopPropagation();
      navigateReference(selectedIndex);
    }
  }

  return (
    <section className="editor-reference-list">
      <h3>{title}</h3>
      {references.length === 0 ? (
        <p className="editor-empty">{emptyLabel}</p>
      ) : (
        <ul onKeyDown={handleKeyDown}>
          {references.map((reference, index) => {
            const linkedRef = useTarget ? reference.to : reference.from;
            return (
              <li key={`${reference.path}-${index}`}>
                <button
                  className="editor-reference-link"
                  onClick={() => navigateReference(index)}
                  onFocus={() => setSelectedIndex(index)}
                  ref={(button) => {
                    buttonRefs.current[index] = button;
                  }}
                  tabIndex={selectedIndex === index ? 0 : -1}
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
