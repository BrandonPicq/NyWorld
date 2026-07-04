import path from "node:path";
import { describe, expect, it } from "vitest";

import { resolveEditorContentPath } from "./editorContentSave";

const projectRoot = path.resolve("/tmp/nywarudo");

describe("resolveEditorContentPath", () => {
  it("accepts JSON files under src/content", () => {
    const result = resolveEditorContentPath(
      projectRoot,
      "src/content/items/items.json",
    );

    expect(result).toEqual({
      ok: true,
      absolutePath: path.resolve(
        projectRoot,
        "src/content/items/items.json",
      ),
      relativePath: "src/content/items/items.json",
    });
  });

  it("accepts content JSON files directly under src/content", () => {
    expect(resolveEditorContentPath(projectRoot, "src/content/game.json"))
      .toMatchObject({
        ok: true,
        relativePath: "src/content/game.json",
      });
  });

  it("normalizes backslash separators", () => {
    expect(
      resolveEditorContentPath(
        projectRoot,
        "src\\content\\items\\items.json",
      ),
    ).toMatchObject({
      ok: true,
      relativePath: "src/content/items/items.json",
    });
  });

  it("rejects paths outside src/content", () => {
    expect(resolveEditorContentPath(projectRoot, "src/game.json")).toEqual({
      ok: false,
      reason: "Content path must be under src/content.",
    });
  });

  it("rejects traversal paths before normalization can hide them", () => {
    expect(
      resolveEditorContentPath(
        projectRoot,
        "src/content/items/../game.json",
      ),
    ).toEqual({
      ok: false,
      reason: "Content path must not traverse directories.",
    });
  });

  it("rejects absolute paths", () => {
    expect(
      resolveEditorContentPath(projectRoot, "/tmp/nywarudo/src/content/game.json"),
    ).toEqual({
      ok: false,
      reason: "Content path must be project-relative.",
    });
  });

  it("rejects non-json files", () => {
    expect(resolveEditorContentPath(projectRoot, "src/content/items/items.ts"))
      .toEqual({
        ok: false,
        reason: "Content path must target a JSON file.",
      });
  });
});
