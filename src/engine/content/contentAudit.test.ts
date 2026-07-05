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
    const presence = ensurePresence(snapshot);

    presence.schedule[0].zoneId = "missing_zone";

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
    const presence = ensurePresence(snapshot);
    const blocked = findBlockedCoordinate(snapshot);
    const targetZone = snapshot.zones[blocked.zoneId];

    presence.schedule = [
      {
        time: "08:00",
        zoneId: blocked.zoneId,
        x: blocked.x,
        y: blocked.y,
      },
      {
        time: "12:00",
        zoneId: blocked.zoneId,
        x: targetZone.width + 1,
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
          contentId: presence.npcId,
          path: "schedule[0]",
          message: `Schedule entry targets a non-walkable tile in zone "${blocked.zoneId}".`,
        }),
        expect.objectContaining({
          contentType: "npc-presence",
          contentId: presence.npcId,
          path: "schedule[1]",
          message: `Schedule entry targets zone "${blocked.zoneId}" outside its bounds.`,
        }),
      ]),
    );
  });

  it("reports zone-local schedules targeting blocked coordinates in a different known zone", () => {
    const snapshot = createRuntimeContentCatalogSnapshot();
    const context = createRuntimeContentValidationContext();
    const sourceZone = Object.values(snapshot.zones)[0];
    const target = findBlockedCoordinateInDifferentZone(
      snapshot,
      sourceZone.zoneId,
    );

    sourceZone.npcs = [
      {
        npcId: firstNpcId(snapshot),
        x: sourceZone.playerStart.x,
        y: sourceZone.playerStart.y,
        schedule: [
          {
            time: "08:00",
            zoneId: target.zoneId,
            x: target.x,
            y: target.y,
          },
        ],
      },
    ];

    const errors = getContentAuditErrors(
      validateAllContent(snapshot, context),
    );

    expect(errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          contentType: "zone",
          contentId: sourceZone.zoneId,
          path: "npcs[0].schedule[0]",
          message: `Schedule entry targets a non-walkable tile in zone "${target.zoneId}".`,
        }),
      ]),
    );
  });
});

function ensurePresence(
  snapshot: ReturnType<typeof createRuntimeContentCatalogSnapshot>,
) {
  if (snapshot.npcPresence[0]) {
    return snapshot.npcPresence[0];
  }

  const zone = Object.values(snapshot.zones)[0];
  snapshot.npcPresence.push({
    npcId: firstNpcId(snapshot),
    schedule: [
      {
        time: "08:00",
        zoneId: zone.zoneId,
        x: zone.playerStart.x,
        y: zone.playerStart.y,
      },
    ],
  });
  return snapshot.npcPresence[0];
}

function firstNpcId(
  snapshot: ReturnType<typeof createRuntimeContentCatalogSnapshot>,
): string {
  const npcId = snapshot.npcs[0]?.npcId;
  if (!npcId) {
    throw new Error("expected at least one authored NPC");
  }
  return npcId;
}

function findBlockedCoordinate(
  snapshot: ReturnType<typeof createRuntimeContentCatalogSnapshot>,
): { zoneId: string; x: number; y: number } {
  for (const zone of Object.values(snapshot.zones)) {
    for (let y = 0; y < zone.tiles.length; y++) {
      for (let x = 0; x < zone.tiles[y].length; x++) {
        const map = createRuntimeContentValidationContext().zones.get(
          zone.zoneId,
        );
        if (map && !map.isWalkable(x, y)) {
          return { zoneId: zone.zoneId, x, y };
        }
      }
    }
  }

  throw new Error("expected at least one blocked authored tile");
}

function findBlockedCoordinateInDifferentZone(
  snapshot: ReturnType<typeof createRuntimeContentCatalogSnapshot>,
  sourceZoneId: string,
): { zoneId: string; x: number; y: number } {
  const blocked = findBlockedCoordinate(snapshot);
  if (blocked.zoneId !== sourceZoneId) {
    return blocked;
  }

  for (const zone of Object.values(snapshot.zones)) {
    if (zone.zoneId === sourceZoneId) {
      continue;
    }
    const map = createRuntimeContentValidationContext().zones.get(zone.zoneId);
    if (!map) {
      continue;
    }
    for (let y = 0; y < zone.tiles.length; y++) {
      for (let x = 0; x < zone.tiles[y].length; x++) {
        if (!map.isWalkable(x, y)) {
          return { zoneId: zone.zoneId, x, y };
        }
      }
    }
  }

  throw new Error("expected a blocked tile in a zone different from the source");
}
