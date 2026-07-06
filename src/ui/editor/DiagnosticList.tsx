import {
  formatContentDiagnostic,
  type ContentDiagnostic,
} from "../../engine";

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
              onClick={() =>
                onNavigate({
                  type: diagnostic.contentType,
                  id: diagnostic.contentId ?? "",
                })
              }
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
