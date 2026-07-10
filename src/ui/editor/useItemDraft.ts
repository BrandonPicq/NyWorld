import { useEffect, useMemo, useState } from "react";
import {
  CONTENT_TYPES,
  validateItemCatalog,
  type ContentCatalogSnapshot,
  type ContentRef,
  type ContentReference,
  type ItemDef,
  type ItemDefMap,
  type RenameImpact,
} from "../../engine";
import {
  ITEM_CATALOG_CONTENT_PATH,
  saveEditorContent,
} from "./editorSaveClient";
import {
  buildContentBrowserGroups,
  cloneItemCatalog,
  formatFileSaveBlocker,
  getFileSaveGate,
  getFileSaveStatus,
  groupDiagnosticsByContentType,
  serializeItemCatalog,
  type SaveStatus,
} from "./editorModel";
import type { CombinedDraftView, DraftSlot } from "./editorDraftTypes";

export interface ItemDraftSlot {
  draft: DraftSlot<ItemDefMap>;
  savedJson: DraftSlot<string>;
}

export function createItemDraftState(base: ContentCatalogSnapshot): ItemDefMap {
  return cloneItemCatalog(base.items);
}

export interface ItemDraftController {
  browserGroups: ReturnType<typeof buildContentBrowserGroups>;
  diagnosticGroups: ReturnType<typeof groupDiagnosticsByContentType>;
  selectedRef: ContentRef;
  setSelectedRef: (ref: ContentRef) => void;
  selectedImpact: RenameImpact;
  incomingRefs: ContentReference[];
  outgoingRefs: ContentReference[];
  errorCount: number;
  warningCount: number;
  itemDraftErrorCount: number;
  totalEntries: number;
  hasUnsavedChanges: boolean;
  selectedItem: ItemDef | null;
  selectedItemDiagnostics: ReturnType<typeof validateItemCatalog>;
  itemIdDraft: string;
  setItemIdDraft: (itemId: string) => void;
  isSaving: boolean;
  canSaveItems: boolean;
  saveStatus: SaveStatus;
  updateSelectedItem: (updater: (item: ItemDef) => ItemDef) => void;
  renameSelectedItem: () => void;
  resetItemDraft: () => void;
  saveItemDraft: () => Promise<void>;
}

export function useItemDraft(
  base: ContentCatalogSnapshot,
  slot: ItemDraftSlot,
  combined: CombinedDraftView,
): ItemDraftController {
  const draftItems = slot.draft.value;
  const setDraftItems = slot.draft.set;
  const savedItemsJson = slot.savedJson.value;
  const setSavedItemsJson = slot.savedJson.set;

  const [saveStatus, setSaveStatus] = useState<SaveStatus>({
    state: "idle",
    message: "No changes.",
  });

  const browserGroups = useMemo(
    () => buildContentBrowserGroups(combined.snapshot),
    [combined.snapshot],
  );
  const diagnosticGroups = useMemo(
    () => groupDiagnosticsByContentType(combined.diagnostics),
    [combined.diagnostics],
  );
  const itemCatalogDiagnostics = useMemo(
    () => validateItemCatalog(draftItems, combined.context),
    [combined.context, draftItems],
  );
  const firstRef = browserGroups[0]?.entries[0]?.ref ?? {
    type: "game",
    id: "game",
  };
  const [selectedRef, setSelectedRef] = useState<ContentRef>(firstRef);
  const [itemIdDraft, setItemIdDraft] = useState(firstRef.id);
  const selectedImpact = combined.graph.getRenameImpact(selectedRef);
  const incomingRefs = combined.graph.getReferencesTo(selectedRef);
  const outgoingRefs = combined.graph.getReferencesFrom(selectedRef);
  const selectedItem =
    selectedRef.type === CONTENT_TYPES.item ? draftItems[selectedRef.id] : null;
  const selectedItemDiagnostics = itemCatalogDiagnostics.filter(
    (diagnostic) => diagnostic.contentId === selectedRef.id,
  );
  const serializedDraftItems = useMemo(
    () => serializeItemCatalog(draftItems),
    [draftItems],
  );
  const hasUnsavedChanges = serializedDraftItems !== savedItemsJson;
  const itemDraftErrorCount = itemCatalogDiagnostics.filter(
    (diagnostic) => diagnostic.severity === "error",
  ).length;
  const totalEntries = browserGroups.reduce(
    (sum, group) => sum + group.entries.length,
    0,
  );
  const isSaving = saveStatus.state === "saving";
  const itemSaveGate = getFileSaveGate(itemCatalogDiagnostics, {
    hasUnsavedChanges,
    isSaving,
  });
  const canSaveItems = itemSaveGate.canSave;
  const displayStatus = getFileSaveStatus(saveStatus, {
    hasUnsavedChanges,
    errorCount: itemSaveGate.errorCount,
  });

  useEffect(() => {
    setItemIdDraft(selectedRef.id);
  }, [selectedRef.id, selectedRef.type]);

  useEffect(() => {
    if (selectedRef.type !== CONTENT_TYPES.item || draftItems[selectedRef.id]) {
      return;
    }

    const firstItemId = Object.keys(draftItems).sort((a, b) =>
      a.localeCompare(b),
    )[0];
    if (firstItemId) {
      setSelectedRef({ type: CONTENT_TYPES.item, id: firstItemId });
    }
  }, [draftItems, selectedRef]);

  function updateSelectedItem(updater: (item: ItemDef) => ItemDef): void {
    if (selectedRef.type !== CONTENT_TYPES.item) {
      return;
    }

    setDraftItems((items) => {
      const current = items[selectedRef.id];
      if (!current) {
        return items;
      }

      return {
        ...items,
        [selectedRef.id]: updater(current),
      };
    });
    setSaveStatus({ state: "idle", message: "Unsaved changes." });
  }

  function renameSelectedItem(): void {
    if (selectedRef.type !== CONTENT_TYPES.item) {
      return;
    }

    const nextId = itemIdDraft.trim();
    if (!nextId) {
      setSaveStatus({ state: "error", message: "Item id cannot be empty." });
      return;
    }

    if (nextId === selectedRef.id) {
      setItemIdDraft(selectedRef.id);
      return;
    }

    if (draftItems[nextId]) {
      setSaveStatus({
        state: "error",
        message: `Item "${nextId}" already exists.`,
      });
      return;
    }

    setDraftItems((items) =>
      Object.fromEntries(
        Object.entries(items).map(([itemId, item]) =>
          itemId === selectedRef.id ? [nextId, item] : [itemId, item],
        ),
      ),
    );
    setSelectedRef({ type: CONTENT_TYPES.item, id: nextId });
    setSaveStatus({ state: "idle", message: "Unsaved changes." });
  }

  function resetItemDraft(): void {
    setDraftItems(cloneItemCatalog(base.items));
    setSavedItemsJson(serializeItemCatalog(base.items));
    setSaveStatus({ state: "idle", message: "No changes." });
  }

  async function saveItemDraft(): Promise<void> {
    if (!hasUnsavedChanges) {
      setSaveStatus({ state: "idle", message: "No changes." });
      return;
    }

    const saveGate = getFileSaveGate(
      validateItemCatalog(draftItems, combined.context),
      { hasUnsavedChanges, isSaving },
    );
    if (saveGate.errorCount > 0) {
      setSaveStatus({
        state: "error",
        message: formatFileSaveBlocker(saveGate.errorCount),
      });
      return;
    }

    const content = serializedDraftItems;
    setSaveStatus({ state: "saving", message: "Saving..." });
    const result = await saveEditorContent(ITEM_CATALOG_CONTENT_PATH, content);
    if (!result.ok) {
      setSaveStatus({ state: "error", message: result.error });
      return;
    }

    setSavedItemsJson(content);
    setSaveStatus({ state: "saved", message: `Saved ${result.path}.` });
  }

  return {
    browserGroups,
    diagnosticGroups,
    selectedRef,
    setSelectedRef,
    selectedImpact,
    incomingRefs,
    outgoingRefs,
    errorCount: combined.errorCount,
    warningCount: combined.warningCount,
    itemDraftErrorCount,
    totalEntries,
    hasUnsavedChanges,
    selectedItem,
    selectedItemDiagnostics,
    itemIdDraft,
    setItemIdDraft,
    isSaving,
    canSaveItems,
    saveStatus: displayStatus,
    updateSelectedItem,
    renameSelectedItem,
    resetItemDraft,
    saveItemDraft,
  };
}
