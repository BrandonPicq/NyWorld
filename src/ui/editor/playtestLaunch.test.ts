import { afterEach, describe, expect, it } from "vitest";
import {
  buildContentReferenceGraph,
  clearContentOverlay,
  createRuntimeContentCatalogSnapshot,
  createRuntimeContentValidationContext,
  getItemDef,
  validateAllContent,
  type ContentCatalogSnapshot,
  type ContentValidationContext,
} from "../../engine";
import type { CombinedDraftView } from "./editorDraftTypes";
import { prepareEditorPlaytest } from "./playtestLaunch";

describe("prepareEditorPlaytest", () => {
  afterEach(() => {
    clearContentOverlay();
  });

  it("runs fresh validation, installs overlays, and returns a draft bundle", () => {
    const snapshot = createRuntimeContentCatalogSnapshot();
    const itemId = Object.keys(snapshot.items)[0];
    snapshot.items[itemId] = {
      ...snapshot.items[itemId],
      name: "Draft Item Name",
    };
    const combined = createCombinedDraftView(
      snapshot,
      createRuntimeContentValidationContext(),
    );

    const result = prepareEditorPlaytest(combined);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.contentBundle.game.defaultZoneId).toBe(
      snapshot.game.defaultZoneId,
    );
    expect(getItemDef(itemId).name).toBe("Draft Item Name");
  });

  it("blocks invalid drafts before installing overlays", () => {
    const snapshot = createRuntimeContentCatalogSnapshot();
    const itemId = Object.keys(snapshot.items)[0];
    const shippedName = getItemDef(itemId).name;
    snapshot.items[itemId] = {
      ...snapshot.items[itemId],
      name: "Draft Item Name",
    };
    snapshot.game.defaultZoneId = "missing_zone";
    const combined = createCombinedDraftView(
      snapshot,
      createRuntimeContentValidationContext(),
    );

    const result = prepareEditorPlaytest(combined);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message).toContain("missing_zone");
    expect(getItemDef(itemId).name).toBe(shippedName);
  });
});

function createCombinedDraftView(
  snapshot: ContentCatalogSnapshot,
  context: ContentValidationContext,
): CombinedDraftView {
  const diagnostics = validateAllContent(snapshot, context);
  const errorCount = diagnostics.filter(
    (diagnostic) => diagnostic.severity === "error",
  ).length;

  return {
    snapshot,
    context,
    diagnostics,
    graph: buildContentReferenceGraph(snapshot),
    errorCount,
    warningCount: diagnostics.length - errorCount,
  };
}
