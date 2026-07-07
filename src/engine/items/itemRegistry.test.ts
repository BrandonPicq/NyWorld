import { afterEach, describe, expect, it } from "vitest";

import itemsData from "../../content/items/items.json";
import {
  getAllItemIds,
  getItemDef,
  hasItemDef,
  clearItemContentOverlay,
  installItemContentOverlay,
  validateItemCatalog,
} from "./itemRegistry";

const validCatalog = {
  test_potion: {
    name: "Test Potion",
    description: "A potion used by tests.",
    category: "consumable",
    defaultQuantity: 1,
  },
};

describe("validateItemCatalog", () => {
  it("accepts a valid item catalog", () => {
    expect(validateItemCatalog(validCatalog)).toEqual([]);
  });

  it("accepts the shipped item catalog", () => {
    expect(validateItemCatalog(itemsData)).toEqual([]);
  });

  it("rejects a catalog that is not an object map", () => {
    expect(validateItemCatalog([])).toEqual([
      expect.objectContaining({
        severity: "error",
        contentType: "item",
        path: "$",
        message: "Item catalog must be an object map of item definitions.",
      }),
    ]);
  });

  it("accumulates several errors across items with precise paths", () => {
    const diagnostics = validateItemCatalog({
      broken_item: {
        name: "",
        description: "Still has a description.",
        category: "weapon",
        defaultQuantity: 0,
      },
      not_an_object: 4,
    });

    expect(diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          contentId: "broken_item",
          path: "name",
          message: 'Item "broken_item" has invalid or missing name.',
        }),
        expect.objectContaining({
          contentId: "broken_item",
          path: "category",
          message:
            'Item "broken_item" has invalid category "weapon". Expected one of: quest, consumable, material, misc.',
        }),
        expect.objectContaining({
          contentId: "broken_item",
          path: "defaultQuantity",
          message:
            'Item "broken_item" has invalid defaultQuantity. Expected a positive integer.',
        }),
        expect.objectContaining({
          contentId: "not_an_object",
          path: "$",
          message: 'Item "not_an_object" must be an object.',
        }),
      ]),
    );
    expect(diagnostics).toHaveLength(4);
  });

  it("validates use effects fields", () => {
    const diagnostics = validateItemCatalog({
      odd_potion: {
        name: "Odd Potion",
        description: "A potion with broken effects.",
        category: "consumable",
        defaultQuantity: 1,
        effects: { energyRestore: 0, hpRestore: 2.5 },
      },
    });

    expect(diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          contentId: "odd_potion",
          path: "effects.energyRestore",
          message:
            'Item "odd_potion" has invalid effects.energyRestore. Expected a positive integer.',
        }),
        expect.objectContaining({
          contentId: "odd_potion",
          path: "effects.hpRestore",
          message:
            'Item "odd_potion" has invalid effects.hpRestore. Expected a positive integer.',
        }),
      ]),
    );
    expect(diagnostics).toHaveLength(2);
  });

  it("warns when a non-consumable declares use effects", () => {
    const diagnostics = validateItemCatalog({
      strange_rock: {
        name: "Strange Rock",
        description: "A rock that thinks it is a potion.",
        category: "material",
        defaultQuantity: 1,
        effects: { energyRestore: 5 },
      },
    });

    expect(diagnostics).toEqual([
      expect.objectContaining({
        severity: "warning",
        contentId: "strange_rock",
        path: "effects",
        message:
          'Item "strange_rock" declares use effects but is not a consumable, so the effects will never apply.',
      }),
    ]);
  });

  it("reports empty item ids", () => {
    const diagnostics = validateItemCatalog({
      "": {
        name: "Nameless",
        description: "An item keyed by an empty id.",
        category: "misc",
        defaultQuantity: 1,
      },
    });

    expect(diagnostics).toEqual([
      expect.objectContaining({
        path: "$",
        message: "Item catalog contains an empty item id.",
      }),
    ]);
  });
});

describe("itemRegistry", () => {
  afterEach(() => {
    clearItemContentOverlay();
  });

  it("exposes shipped item ids in deterministic order", () => {
    const ids = getAllItemIds();

    expect(ids).toEqual([...ids].sort());
    expect(ids.length).toBeGreaterThan(0);
    expect(hasItemDef(ids[0])).toBe(true);
    expect(hasItemDef("missing_item")).toBe(false);
  });

  it("returns detached item definitions", () => {
    const itemId = getAllItemIds()[0];
    const authoredName = getItemDef(itemId).name;
    const first = getItemDef(itemId);
    first.name = "Mutated";

    expect(getItemDef(itemId).name).toBe(authoredName);
  });

  it("falls back to a safe definition for unknown ids", () => {
    const def = getItemDef("missing_item");

    expect(def).toEqual(
      expect.objectContaining({ name: "Unknown Item", category: "misc" }),
    );
    expect(def.effects).toBeUndefined();
  });

  it("exposes authored consumable effects", () => {
    const itemsWithEffects = getAllItemIds()
      .map((itemId) => getItemDef(itemId))
      .filter((item) => item.effects);

    for (const item of itemsWithEffects) {
      expect(item.effects?.energyRestore ?? 1).toBeGreaterThan(0);
      expect(item.effects?.hpRestore ?? 1).toBeGreaterThan(0);
    }
  });

  it("serves detached draft definitions from a dev content overlay", () => {
    const shippedIds = getAllItemIds();

    installItemContentOverlay({
      draft_ration: {
        name: "Draft Ration",
        description: "A ration from the editor draft.",
        category: "consumable",
        defaultQuantity: 2,
        effects: { energyRestore: 9 },
      },
    });

    expect(getAllItemIds()).toEqual(["draft_ration"]);
    expect(hasItemDef("draft_ration")).toBe(true);
    expect(getItemDef("draft_ration")).toMatchObject({
      name: "Draft Ration",
      effects: { energyRestore: 9 },
    });

    const firstRead = getItemDef("draft_ration");
    firstRead.name = "Mutated";
    expect(getItemDef("draft_ration").name).toBe("Draft Ration");

    const fallback = getItemDef("missing_overlay_item");
    expect(fallback.name).toBe("Unknown Item");
    expect(fallback.effects).toBeUndefined();

    clearItemContentOverlay();
    expect(getAllItemIds()).toEqual(shippedIds);
    expect(hasItemDef("draft_ration")).toBe(false);
  });
});
