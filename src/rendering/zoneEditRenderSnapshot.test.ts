import { describe, expect, it } from "vitest";
import type { ZoneData } from "../engine/ZoneTypes";
import { createZoneEditRenderSnapshot } from "./zoneEditRenderSnapshot";

function createZone(overrides: Partial<ZoneData> = {}): ZoneData {
  return {
    version: "0.1",
    zoneId: "test_zone",
    name: "Test Zone",
    width: 2,
    height: 2,
    playerStart: { x: 1, y: 0 },
    tiles: [
      [0, 1],
      [1, 0],
    ],
    ...overrides,
  };
}

describe("createZoneEditRenderSnapshot", () => {
  it("resolves tiles and marks the authored player start", () => {
    const snapshot = createZoneEditRenderSnapshot(createZone());

    expect(snapshot.width).toBe(2);
    expect(snapshot.height).toBe(2);
    expect(snapshot.player).toEqual({ x: 1, y: 0 });
    expect(snapshot.tiles).toEqual([
      [
        { glyph: ".", role: "open" },
        { glyph: "#", role: "blocked" },
      ],
      [
        { glyph: "#", role: "blocked" },
        { glyph: ".", role: "open" },
      ],
    ]);
    expect(snapshot.entities).toEqual([]);
  });

  it("projects NPC then item spawns using the shared presentation helpers", () => {
    // Unknown ids resolve to registry fallbacks: an "unknown" race NPC and a
    // "misc" item, both with deterministic glyph and color.
    const snapshot = createZoneEditRenderSnapshot(
      createZone({
        npcs: [{ npcId: "phantom", x: 0, y: 0 }],
        items: [{ itemId: "trinket", x: 1, y: 1, quantity: 3 }],
      }),
    );

    expect(snapshot.entities).toEqual([
      {
        x: 0,
        y: 0,
        glyph: "n",
        color: "#cdd6f4",
        npcId: "phantom",
        name: "Unknown NPC",
      },
      {
        x: 1,
        y: 1,
        glyph: "*",
        color: "#f9e2af",
      },
    ]);
  });
});
