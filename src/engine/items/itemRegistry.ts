import itemsData from "../../content/items/items.json";
import type { ContentDiagnostic } from "../content/ContentDiagnostic";
import { formatContentDiagnostic } from "../content/ContentDiagnostic";
import { CONTENT_TYPES } from "../content/contentTypes";
import { ITEM_CATEGORY_OPTIONS } from "../content/editingMetadata";
import type { ItemDef, ItemDefMap } from "./ItemDef";

const ITEM_CONTENT_TYPE = CONTENT_TYPES.item;

const ITEM_EFFECT_FIELDS = ["energyRestore", "hpRestore"] as const;

const fallback: ItemDef = {
  name: "Unknown Item",
  description: "An item that is not yet defined.",
  category: "misc",
  defaultQuantity: 1,
};

let overlayRegistry: ItemDefMap | null = null;

const registry = buildRegistry(itemsData);

/**
 * Validates a raw item catalog without throwing.
 *
 * This is the editor-facing path: it accumulates every authoring problem so
 * tools can report several precise issues at once. Items are a leaf content
 * type, so no validation context is needed.
 */
export function validateItemCatalog(value: unknown): ContentDiagnostic[] {
  const diagnostics: ContentDiagnostic[] = [];

  if (!isRecord(value)) {
    addItemError(
      diagnostics,
      undefined,
      "$",
      "Item catalog must be an object map of item definitions.",
    );
    return diagnostics;
  }

  for (const [itemId, def] of Object.entries(value)) {
    if (!itemId.trim()) {
      addItemError(
        diagnostics,
        undefined,
        "$",
        "Item catalog contains an empty item id.",
      );
      continue;
    }

    validateItemDef(itemId, def, diagnostics);
  }

  return diagnostics;
}

function validateItemDef(
  itemId: string,
  value: unknown,
  diagnostics: ContentDiagnostic[],
): void {
  if (!isRecord(value)) {
    addItemError(
      diagnostics,
      itemId,
      "$",
      `Item "${itemId}" must be an object.`,
    );
    return;
  }

  if (typeof value.name !== "string" || !value.name.trim()) {
    addItemError(
      diagnostics,
      itemId,
      "name",
      `Item "${itemId}" has invalid or missing name.`,
    );
  }

  if (typeof value.description !== "string" || !value.description.trim()) {
    addItemError(
      diagnostics,
      itemId,
      "description",
      `Item "${itemId}" has invalid or missing description.`,
    );
  }

  if (
    typeof value.category !== "string" ||
    !(ITEM_CATEGORY_OPTIONS as readonly string[]).includes(value.category)
  ) {
    addItemError(
      diagnostics,
      itemId,
      "category",
      `Item "${itemId}" has invalid category "${String(value.category)}". Expected one of: ${ITEM_CATEGORY_OPTIONS.join(", ")}.`,
    );
  }

  if (
    typeof value.defaultQuantity !== "number" ||
    !Number.isInteger(value.defaultQuantity) ||
    value.defaultQuantity <= 0
  ) {
    addItemError(
      diagnostics,
      itemId,
      "defaultQuantity",
      `Item "${itemId}" has invalid defaultQuantity. Expected a positive integer.`,
    );
  }

  if (value.effects !== undefined) {
    validateItemEffects(itemId, value.effects, value.category, diagnostics);
  }
}

function validateItemEffects(
  itemId: string,
  value: unknown,
  category: unknown,
  diagnostics: ContentDiagnostic[],
): void {
  if (!isRecord(value)) {
    addItemError(
      diagnostics,
      itemId,
      "effects",
      `Item "${itemId}" effects must be an object.`,
    );
    return;
  }

  for (const field of ITEM_EFFECT_FIELDS) {
    const effectValue = value[field];
    if (effectValue === undefined) {
      continue;
    }

    if (
      typeof effectValue !== "number" ||
      !Number.isInteger(effectValue) ||
      effectValue <= 0
    ) {
      addItemError(
        diagnostics,
        itemId,
        `effects.${field}`,
        `Item "${itemId}" has invalid effects.${field}. Expected a positive integer.`,
      );
    }
  }

  if (category !== "consumable") {
    diagnostics.push({
      severity: "warning",
      contentType: ITEM_CONTENT_TYPE,
      contentId: itemId,
      path: "effects",
      message: `Item "${itemId}" declares use effects but is not a consumable, so the effects will never apply.`,
    });
  }
}

function buildRegistry(value: unknown): ItemDefMap {
  const diagnostics = validateItemCatalog(value);
  const firstError = diagnostics.find(
    (diagnostic) => diagnostic.severity === "error",
  );

  if (firstError) {
    throw new Error(formatContentDiagnostic(firstError));
  }

  const catalog = value as ItemDefMap;
  return Object.fromEntries(
    Object.entries(catalog).map(([itemId, def]) => [itemId, cloneItemDef(def)]),
  );
}

function cloneItemDef(def: ItemDef): ItemDef {
  return {
    ...def,
    effects: def.effects ? { ...def.effects } : undefined,
  };
}

function addItemError(
  diagnostics: ContentDiagnostic[],
  itemId: string | undefined,
  path: string,
  message: string,
): void {
  diagnostics.push({
    severity: "error",
    contentType: ITEM_CONTENT_TYPE,
    contentId: itemId,
    path,
    message,
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Returns true when an item id is defined in the item catalog.
 *
 * Loaders use this to reject broken content references before gameplay starts.
 */
export function hasItemDef(itemId: string): boolean {
  return Object.prototype.hasOwnProperty.call(getActiveRegistry(), itemId);
}

/**
 * Returns every registered item id in deterministic order.
 */
export function getAllItemIds(): string[] {
  return Object.keys(getActiveRegistry()).sort();
}

/**
 * Returns catalog metadata for an item id.
 *
 * Unknown ids resolve to a safe fallback for display code, but content loaders
 * should still validate ids with hasItemDef before accepting authored data.
 */
export function getItemDef(itemId: string): ItemDef {
  const def = getActiveRegistry()[itemId];
  return def ? cloneItemDef(def) : cloneItemDef(fallback);
}

export function installItemContentOverlay(items: ItemDefMap): void {
  if (!import.meta.env.DEV) return;
  overlayRegistry = buildRegistry(items);
}

export function clearItemContentOverlay(): void {
  overlayRegistry = null;
}

function getActiveRegistry(): ItemDefMap {
  return overlayRegistry ?? registry;
}

if (import.meta.hot) {
  import.meta.hot.dispose(clearItemContentOverlay);
}
