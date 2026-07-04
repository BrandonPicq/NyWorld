import { describe, expect, it } from "vitest";

import { formatContentDiagnostic } from "./ContentDiagnostic";
import { getContentAuditErrors, validateAllContent } from "./contentAudit";
import { createRuntimeContentCatalogSnapshot } from "./runtimeContentCatalog";
import { createRuntimeContentValidationContext } from "./runtimeValidationContext";

describe("validateAllContent", () => {
  it("reports zero errors for the shipped content bundle", () => {
    const diagnostics = validateAllContent(
      createRuntimeContentCatalogSnapshot(),
      createRuntimeContentValidationContext(),
    );

    const errors = getContentAuditErrors(diagnostics);
    expect(
      errors.map(formatContentDiagnostic),
    ).toEqual([]);
  });

  it("reports cross-content problems per-registry validation cannot see", () => {
    const snapshot = createRuntimeContentCatalogSnapshot();
    const context = createRuntimeContentValidationContext();

    snapshot.npcPresence[0].schedule[0].zoneId = "missing_zone";

    const errors = getContentAuditErrors(
      validateAllContent(snapshot, context),
    );

    expect(errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          contentType: "npc-presence",
          path: "schedule[0].zoneId",
          message: expect.stringContaining('unknown zone "missing_zone"'),
        }),
      ]),
    );
  });
});
