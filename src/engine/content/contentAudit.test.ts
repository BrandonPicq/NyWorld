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

  it("reports global presence schedules targeting blocked or missing coordinates in known zones", () => {
    const snapshot = createRuntimeContentCatalogSnapshot();
    const context = createRuntimeContentValidationContext();

    snapshot.npcPresence[0].schedule = [
      {
        time: "08:00",
        zoneId: "test_zone",
        x: 0,
        y: 0,
      },
      {
        time: "12:00",
        zoneId: "test_zone",
        x: 99,
        y: 1,
      },
    ];

    const errors = getContentAuditErrors(
      validateAllContent(snapshot, context),
    );

    expect(errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          contentType: "npc-presence",
          contentId: snapshot.npcPresence[0].npcId,
          path: "schedule[0]",
          message:
            'Schedule entry targets a non-walkable tile in zone "test_zone".',
        }),
        expect.objectContaining({
          contentType: "npc-presence",
          contentId: snapshot.npcPresence[0].npcId,
          path: "schedule[1]",
          message: 'Schedule entry targets zone "test_zone" outside its bounds.',
        }),
      ]),
    );
  });

  it("reports zone-local schedules targeting blocked coordinates in a different known zone", () => {
    const snapshot = createRuntimeContentCatalogSnapshot();
    const context = createRuntimeContentValidationContext();

    snapshot.zones.test_zone.npcs![0].schedule = [
      {
        time: "08:00",
        zoneId: "test_zone_2",
        x: 0,
        y: 0,
      },
    ];

    const errors = getContentAuditErrors(
      validateAllContent(snapshot, context),
    );

    expect(errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          contentType: "zone",
          contentId: "test_zone",
          path: "npcs[0].schedule[0]",
          message:
            'Schedule entry targets a non-walkable tile in zone "test_zone_2".',
        }),
      ]),
    );
  });
});
