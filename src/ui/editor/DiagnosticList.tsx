import {
  formatContentDiagnostic,
  type ContentDiagnostic,
} from "../../engine";
import { useEffect, useState } from "react";

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

  useEffect(() => {
    if (!diagnostics[selectedIndex]?.contentId) {
      setSelectedIndex(firstNavigableDiagnosticIndex(diagnostics));
    }
  }, [diagnostics, selectedIndex]);

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

  return (
    <ul className="editor-diagnostic-list">
      {diagnostics.map((diagnostic, index) => (
        <li
          className={`editor-diagnostic editor-diagnostic--${diagnostic.severity}`}
          key={`${diagnostic.contentType}-${diagnostic.contentId ?? "bundle"}-${diagnostic.path}-${index}`}
        >
          {diagnostic.contentId ? (
            <button
              className="editor-diagnostic-link"
              onClick={() => activateDiagnostic(index)}
              onFocus={() => setSelectedIndex(index)}
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

