import {
  formatContentDiagnostic,
  type ContentDiagnostic,
} from "../../engine";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { consumeIfPointerOverKeyboardBlockingElement } from "../menu/pointerKeyboardBlock";

export type EditorContentNavigationTarget = {
  type: string;
  id: string;
};

type DiagnosticListProps = {
  diagnostics: readonly ContentDiagnostic[];
  onNavigate: (target: EditorContentNavigationTarget) => void;
};

/**
 * Shared diagnostic renderer for editor panels.
 *
 * Diagnostics with a content id can jump to that content entry; bundle-level
 * diagnostics stay plain text because there is no concrete target to select.
 */
export function DiagnosticList({
  diagnostics,
  onNavigate,
}: DiagnosticListProps) {
  const [selectedIndex, setSelectedIndex] = useState(
    firstNavigableDiagnosticIndex(diagnostics),
  );
  const buttonRefs = useRef<Array<HTMLButtonElement | null>>([]);

  useEffect(() => {
    if (!diagnostics[selectedIndex]?.contentId) {
      setSelectedIndex(firstNavigableDiagnosticIndex(diagnostics));
    }
  }, [diagnostics, selectedIndex]);

  function moveSelection(direction: -1 | 1): void {
    const nextIndex = getNextNavigableDiagnosticIndex(
      diagnostics,
      selectedIndex,
      direction,
    );
    if (nextIndex === selectedIndex) {
      return;
    }
    setSelectedIndex(nextIndex);
    requestAnimationFrame(() => buttonRefs.current[nextIndex]?.focus());
  }

  function activateDiagnostic(index: number): void {
    const diagnostic = diagnostics[index];
    if (!diagnostic?.contentId) {
      return;
    }
    onNavigate({
      type: diagnostic.contentType,
      id: diagnostic.contentId,
    });
  }

  function handleKeyDown(event: KeyboardEvent<HTMLElement>): void {
    if (event.key === "ArrowDown") {
      if (consumeIfPointerOverKeyboardBlockingElement(event)) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      moveSelection(1);
      return;
    }

    if (event.key === "ArrowUp") {
      if (consumeIfPointerOverKeyboardBlockingElement(event)) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      moveSelection(-1);
      return;
    }

    if (event.key === "Enter") {
      if (consumeIfPointerOverKeyboardBlockingElement(event)) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      activateDiagnostic(selectedIndex);
    }
  }

  return (
    <ul className="editor-diagnostic-list" onKeyDown={handleKeyDown}>
      {diagnostics.map((diagnostic, index) => (
        <li
          className={`editor-diagnostic editor-diagnostic--${diagnostic.severity}`}
          key={`${diagnostic.contentType}-${diagnostic.contentId ?? "bundle"}-${diagnostic.path}-${index}`}
        >
          {diagnostic.contentId ? (
            <button
              className="editor-diagnostic-link"
              data-keyboard-blocking-hover="true"
              onClick={() => activateDiagnostic(index)}
              onFocus={() => setSelectedIndex(index)}
              ref={(button) => {
                buttonRefs.current[index] = button;
              }}
              tabIndex={selectedIndex === index ? 0 : -1}
              type="button"
            >
              {formatContentDiagnostic(diagnostic)}
            </button>
          ) : (
            formatContentDiagnostic(diagnostic)
          )}
        </li>
      ))}
    </ul>
  );
}

function firstNavigableDiagnosticIndex(
  diagnostics: readonly ContentDiagnostic[],
): number {
  return diagnostics.findIndex((diagnostic) => diagnostic.contentId);
}

function getNextNavigableDiagnosticIndex(
  diagnostics: readonly ContentDiagnostic[],
  currentIndex: number,
  direction: -1 | 1,
): number {
  const indexes = diagnostics
    .map((diagnostic, index) => (diagnostic.contentId ? index : -1))
    .filter((index) => index >= 0);
  if (indexes.length === 0) {
    return -1;
  }
  const currentPosition = indexes.indexOf(currentIndex);
  if (currentPosition < 0) {
    return direction === 1 ? indexes[0] : indexes[indexes.length - 1];
  }
  const nextPosition =
    (currentPosition + direction + indexes.length) % indexes.length;
  return indexes[nextPosition];
}
