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

  it("accumulates several errors with precise paths", () => {
    const diagnostics = validateTileCatalog({
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
    expect(hasTileDef(0)).toBe(true);
    expect(hasTileDef(1)).toBe(true);
    expect(hasTileDef(2)).toBe(false);

    expect(getTileDef(0)).toEqual(
      expect.objectContaining({ name: "floor", walkable: true }),
    );
    expect(getTileDef(1)).toEqual(
      expect.objectContaining({ name: "wall", walkable: false }),
    );
  });

  it("falls back to the floor tile for unknown ids", () => {
    expect(getTileDef(99).name).toBe("floor");
  });

  it("returns a detached tile definition map", () => {
    const defs = getAllTileDefs();

    expect([...defs.keys()].sort()).toEqual([0, 1]);

    const floor = defs.get(0);
    expect(floor).toBeDefined();
    floor!.name = "mutated";
    expect(getTileDef(0).name).toBe("floor");
  });
});
