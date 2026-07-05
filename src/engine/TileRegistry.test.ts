import { describe, expect, it } from "vitest";

import tilesData from "../content/tiles/tiles.json";
import {
  getAllTileDefs,
  getTileDef,
  hasTileDef,
  validateTileCatalog,
} from "./TileRegistry";

describe("validateTileCatalog", () => {
  it("accepts the shipped tile catalog", () => {
    expect(validateTileCatalog(tilesData)).toEqual([]);
  });

  it("rejects a catalog that is not an object map", () => {
    expect(validateTileCatalog(null)).toEqual([
      expect.objectContaining({
        severity: "error",
        contentType: "tile",
        path: "$",
        message: "Tile catalog must be an object map of tile definitions.",
      }),
    ]);
  });

  it("requires tile 0 for unknown-tile fallback", () => {
    const diagnostics = validateTileCatalog({
      "1": { name: "wall", walkable: false, glyph: "#", color: "#666666" },
    });

    expect(diagnostics).toEqual([
      expect.objectContaining({
        contentId: "0",
        path: "$",
        message:
          'Tile catalog must include tile id "0" because unknown tile ids fall back to tile 0.',
      }),
    ]);
  });

  it("accumulates several errors with precise paths", () => {
    const diagnostics = validateTileCatalog({
      "0": { name: "floor", walkable: true, glyph: ".", color: "#333333" },
      "2": { name: "", walkable: "yes", glyph: "~~", color: "#123456" },
      "-1": { name: "void", walkable: false, glyph: "x", color: "#000000" },
    });

    expect(diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          contentId: "2",
          path: "name",
          message: 'Tile "2" has invalid or missing name.',
        }),
        expect.objectContaining({
          contentId: "2",
          path: "walkable",
          message: 'Tile "2" has invalid or missing walkable flag.',
        }),
        expect.objectContaining({
          contentId: "2",
          path: "glyph",
          message: 'Tile "2" glyph must be exactly one character.',
        }),
        expect.objectContaining({
          contentId: "-1",
          path: "$",
          message: 'Tile id "-1" must be a non-negative integer.',
        }),
      ]),
    );
    expect(diagnostics).toHaveLength(4);
  });
});

describe("TileRegistry", () => {
  it("exposes the authored floor and wall tiles", () => {
    const unknownTileId = nextUnknownTileId();

    expect(hasTileDef(0)).toBe(true);
    expect(hasTileDef(1)).toBe(true);
    expect(hasTileDef(unknownTileId)).toBe(false);

    expect(getTileDef(0)).toEqual(
      expect.objectContaining({ name: "floor", walkable: true }),
    );
    expect(getTileDef(1)).toEqual(
      expect.objectContaining({ name: "wall", walkable: false }),
    );
  });

  it("falls back to the floor tile for unknown ids", () => {
    expect(getTileDef(nextUnknownTileId()).name).toBe("floor");
  });

  it("returns a detached tile definition map", () => {
    const defs = getAllTileDefs();

    expect(defs.has(0)).toBe(true);
    expect([...defs.keys()]).toEqual([...defs.keys()].sort((a, b) => a - b));

    const floor = defs.get(0);
    expect(floor).toBeDefined();
    floor!.name = "mutated";
    expect(getTileDef(0).name).toBe("floor");
  });
});

function nextUnknownTileId(): number {
  return Math.max(...getAllTileDefs().keys()) + 1;
}
