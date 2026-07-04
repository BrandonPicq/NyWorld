export type ContentDiagnosticSeverity = "error" | "warning";

/**
 * Editor-facing description of a content issue.
 *
 * Diagnostics are detached from thrown runtime errors so tools can collect and
 * display several authoring problems before the content is converted into
 * gameplay objects.
 */
export interface ContentDiagnostic {
  severity: ContentDiagnosticSeverity;
  contentType: string;
  contentId?: string;
  path: string;
  message: string;
}

/**
 * Returns true when any diagnostic blocks runtime use of the content.
 */
export function hasContentDiagnosticErrors(
  diagnostics: readonly ContentDiagnostic[],
): boolean {
  return diagnostics.some((diagnostic) => diagnostic.severity === "error");
}

/**
 * Formats one diagnostic for logs, test failures, or simple editor output.
 */
export function formatContentDiagnostic(
  diagnostic: ContentDiagnostic,
): string {
  const contentRef = diagnostic.contentId
    ? `${diagnostic.contentType}:${diagnostic.contentId}`
    : diagnostic.contentType;

  return `${diagnostic.severity.toUpperCase()} ${contentRef} ${diagnostic.path}: ${diagnostic.message}`;
}
