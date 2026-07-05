import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  buildContentReferenceGraph,
  CONTENT_TYPES,
  createRuntimeContentCatalogSnapshot,
  createRuntimeContentValidationContext,
  formatContentDiagnostic,
  ITEM_CATEGORY_OPTIONS,
  validateAllContent,
  validateItemCatalog,
  type ContentRef,
  type ContentReference,
  type ItemDef,
  type ItemDefMap,
  type RenameImpact,
} from "../../engine";
import { TerminalButton } from "../components/TerminalButton";
import { TerminalPanel } from "../components/TerminalPanel";
import {
  ITEM_CATALOG_CONTENT_PATH,
  saveEditorContent,
} from "./editorSaveClient";
import {
  buildContentBrowserGroups,
  cloneItemCatalog,
  createItemDraftSnapshot,
  createItemDraftValidationContext,
  formatContentRef,
  groupDiagnosticsByContentType,
  refsEqual,
  serializeItemCatalog,
} from "./editorModel";
import { ScrollRegion } from "../components/ScrollRegion";
import { ZoneViewerPanel } from "./zone/ZoneViewerPanel";

type ContentEditorScreenProps = {
  onBack: () => void;
};

type EditorTab = "content" | "zones";

type SaveStatus =
  | { state: "idle"; message: string }
  | { state: "saving"; message: string }
  | { state: "saved"; message: string }
  | { state: "error"; message: string };

export function ContentEditorScreen({ onBack }: ContentEditorScreenProps) {
  const baseSnapshot = useMemo(() => createRuntimeContentCatalogSnapshot(), []);
  const baseValidationContext = useMemo(
    () => createRuntimeContentValidationContext(),
    [],
  );
  const [draftItems, setDraftItems] = useState<ItemDefMap>(() =>
    cloneItemCatalog(baseSnapshot.items),
  );
  const [savedItemsJson, setSavedItemsJson] = useState(() =>
    serializeItemCatalog(baseSnapshot.items),
  );
  const [saveStatus, setSaveStatus] = useState<SaveStatus>({
    state: "idle",
    message: "No changes.",
  });
  const [tab, setTab] = useState<EditorTab>("content");

  const { diagnostics, diagnosticGroups, graph, browserGroups } =
    useMemo(() => {
      const snapshot = createItemDraftSnapshot(baseSnapshot, draftItems);
      const validationContext = createItemDraftValidationContext(
        baseValidationContext,
        draftItems,
      );
      const nextDiagnostics = validateAllContent(snapshot, validationContext);

      return {
        diagnostics: nextDiagnostics,
        diagnosticGroups: groupDiagnosticsByContentType(nextDiagnostics),
        graph: buildContentReferenceGraph(snapshot),
        browserGroups: buildContentBrowserGroups(snapshot),
      };
    }, [baseSnapshot, baseValidationContext, draftItems]);
  const itemCatalogDiagnostics = useMemo(
    () => validateItemCatalog(draftItems),
    [draftItems],
  );
  const firstRef = browserGroups[0]?.entries[0]?.ref ?? {
    type: "game",
    id: "game",
  };
  const [selectedRef, setSelectedRef] = useState<ContentRef>(firstRef);
  const [itemIdDraft, setItemIdDraft] = useState(firstRef.id);
  const selectedImpact = graph.getRenameImpact(selectedRef);
  const incomingRefs = graph.getReferencesTo(selectedRef);
  const outgoingRefs = graph.getReferencesFrom(selectedRef);
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
  const errorCount = diagnostics.filter(
    (diagnostic) => diagnostic.severity === "error",
  ).length;
  const warningCount = diagnostics.length - errorCount;
  const itemDraftErrorCount = itemCatalogDiagnostics.filter(
    (diagnostic) => diagnostic.severity === "error",
  ).length;
  const totalEntries = browserGroups.reduce(
    (sum, group) => sum + group.entries.length,
    0,
  );
  const isSaving = saveStatus.state === "saving";
  const canSaveItems = hasUnsavedChanges && errorCount === 0 && !isSaving;

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

  function updateSelectedItem(
    updater: (item: ItemDef) => ItemDef,
  ): void {
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
    setDraftItems(cloneItemCatalog(baseSnapshot.items));
    setSavedItemsJson(serializeItemCatalog(baseSnapshot.items));
    setSaveStatus({ state: "idle", message: "No changes." });
  }

  async function saveItemDraft(): Promise<void> {
    if (!hasUnsavedChanges) {
      setSaveStatus({ state: "idle", message: "No changes." });
      return;
    }

    if (errorCount > 0) {
      setSaveStatus({
        state: "error",
        message: "Resolve errors before saving.",
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

  return (
    <main
      className="app-shell app-shell--bounded editor-screen"
      aria-labelledby="editor-heading"
    >
      <div className="editor-shell">
        <header className="editor-header">
          <div>
            <p className="terminal-kicker">NYWARUDO // DEV CONTENT</p>
            <h1 className="terminal-heading-md" id="editor-heading">
              Content Editor
            </h1>
          </div>
          <TerminalButton className="editor-header__back" onClick={onBack}>
            Back
          </TerminalButton>
        </header>

        <nav className="editor-tabs" aria-label="Editor sections">
          <TerminalButton
            className="editor-tab"
            isSelected={tab === "content"}
            onClick={() => setTab("content")}
          >
            Content
          </TerminalButton>
          <TerminalButton
            className="editor-tab"
            isSelected={tab === "zones"}
            onClick={() => setTab("zones")}
          >
            Zones
          </TerminalButton>
        </nav>

        {tab === "zones" ? (
          <ZoneViewerPanel snapshot={baseSnapshot} />
        ) : (
          <ContentTab
            browserGroups={browserGroups}
            diagnosticGroups={diagnosticGroups}
            errorCount={errorCount}
            warningCount={warningCount}
            itemDraftErrorCount={itemDraftErrorCount}
            totalEntries={totalEntries}
            hasUnsavedChanges={hasUnsavedChanges}
            selectedRef={selectedRef}
            setSelectedRef={setSelectedRef}
            selectedImpact={selectedImpact}
            incomingRefs={incomingRefs}
            outgoingRefs={outgoingRefs}
            itemEditor={
              <ItemDraftEditor
                canSave={canSaveItems}
                isSaving={isSaving}
                item={selectedItem}
                itemDiagnostics={selectedItemDiagnostics}
                itemIdDraft={itemIdDraft}
                onApplyItemId={renameSelectedItem}
                onCategoryChange={(category) =>
                  updateSelectedItem((item) => ({ ...item, category }))
                }
                onDefaultQuantityChange={(value) =>
                  updateSelectedItem((item) => ({
                    ...item,
                    defaultQuantity: parseNumberDraft(value),
                  }))
                }
                onDescriptionChange={(description) =>
                  updateSelectedItem((item) => ({ ...item, description }))
                }
                onEffectChange={(field, value) =>
                  updateSelectedItem((item) =>
                    updateItemEffect(item, field, value),
                  )
                }
                onItemIdDraftChange={setItemIdDraft}
                onNameChange={(name) =>
                  updateSelectedItem((item) => ({ ...item, name }))
                }
                onReset={resetItemDraft}
                onSave={saveItemDraft}
                saveStatus={saveStatus}
                selectedRef={selectedRef}
                hasUnsavedChanges={hasUnsavedChanges}
              />
            }
          />
        )}
      </div>
    </main>
  );
}

type ContentTabProps = {
  browserGroups: ReturnType<typeof buildContentBrowserGroups>;
  diagnosticGroups: ReturnType<typeof groupDiagnosticsByContentType>;
  errorCount: number;
  warningCount: number;
  itemDraftErrorCount: number;
  totalEntries: number;
  hasUnsavedChanges: boolean;
  selectedRef: ContentRef;
  setSelectedRef: (ref: ContentRef) => void;
  selectedImpact: RenameImpact;
  incomingRefs: ContentReference[];
  outgoingRefs: ContentReference[];
  itemEditor: ReactNode;
};

function ContentTab({
  browserGroups,
  diagnosticGroups,
  errorCount,
  warningCount,
  itemDraftErrorCount,
  totalEntries,
  hasUnsavedChanges,
  selectedRef,
  setSelectedRef,
  selectedImpact,
  incomingRefs,
  outgoingRefs,
  itemEditor,
}: ContentTabProps) {
  return (
    <>
      <section className="editor-summary" aria-label="Content summary">
        <span>{browserGroups.length} families</span>
        <span>{totalEntries} entries</span>
        <span>{errorCount} errors</span>
        <span>{warningCount} warnings</span>
        <span>{itemDraftErrorCount} item draft errors</span>
        <span>{hasUnsavedChanges ? "unsaved" : "saved"}</span>
      </section>

      <div className="editor-grid">
        <TerminalPanel className="editor-panel editor-browser">
          <h2 className="editor-panel__title">Content</h2>
          <ScrollRegion className="editor-scroll" role="list">
            {browserGroups.map((group) => (
              <section className="editor-family" key={group.type}>
                <div className="editor-family__header">
                  <h3>{group.label}</h3>
                  <span>{group.entries.length}</span>
                </div>
                <div className="editor-entry-list">
                  {group.entries.map((entry) => (
                    <TerminalButton
                      className="editor-entry-button"
                      isSelected={refsEqual(entry.ref, selectedRef)}
                      key={`${entry.ref.type}:${entry.ref.id}`}
                      onClick={() => setSelectedRef(entry.ref)}
                    >
                      {entry.label}
                    </TerminalButton>
                  ))}
                </div>
              </section>
            ))}
          </ScrollRegion>
        </TerminalPanel>

        <TerminalPanel className="editor-panel editor-problems">
          <h2 className="editor-panel__title">Problems</h2>
          {diagnosticGroups.length === 0 ? (
            <p className="editor-empty">No content problems.</p>
          ) : (
            <ScrollRegion className="editor-scroll">
              {diagnosticGroups.map((group) => (
                <section
                  className="editor-diagnostic-group"
                  key={group.contentType}
                >
                  <div className="editor-family__header">
                    <h3>{group.contentType}</h3>
                    <span>
                      {group.errorCount}E / {group.warningCount}W
                    </span>
                  </div>
                  <ul className="editor-diagnostic-list">
                    {group.diagnostics.map((diagnostic, index) => (
                      <li
                        className={`editor-diagnostic editor-diagnostic--${diagnostic.severity}`}
                        key={`${group.contentType}-${diagnostic.path}-${index}`}
                      >
                        {formatContentDiagnostic(diagnostic)}
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </ScrollRegion>
          )}
        </TerminalPanel>

        <TerminalPanel className="editor-panel editor-reference">
          <h2 className="editor-panel__title">Editor</h2>
          <ScrollRegion className="editor-scroll">
            {itemEditor}

            <h2 className="editor-panel__title">References</h2>
            <div className="editor-selected-ref">
              <span>{selectedRef.type}</span>
              <strong>{selectedRef.id}</strong>
            </div>

            <div className="editor-impact">
              <p>
                Rename impact: {selectedImpact.references.length} references
              </p>
              <p>
                Save persistence:{" "}
                {selectedImpact.appearsInSaves ? "yes" : "no"}
              </p>
            </div>

            <div className="editor-reference-columns">
              <ReferenceList
                emptyLabel="No incoming references."
                onSelectRef={setSelectedRef}
                references={incomingRefs}
                title="Incoming"
                useTarget={false}
              />
              <ReferenceList
                emptyLabel="No outgoing references."
                onSelectRef={setSelectedRef}
                references={outgoingRefs}
                title="Outgoing"
                useTarget
              />
            </div>
          </ScrollRegion>
        </TerminalPanel>
      </div>
    </>
  );
}

function ItemDraftEditor({
  canSave,
  hasUnsavedChanges,
  isSaving,
  item,
  itemDiagnostics,
  itemIdDraft,
  onApplyItemId,
  onCategoryChange,
  onDefaultQuantityChange,
  onDescriptionChange,
  onEffectChange,
  onItemIdDraftChange,
  onNameChange,
  onReset,
  onSave,
  saveStatus,
  selectedRef,
}: {
  canSave: boolean;
  hasUnsavedChanges: boolean;
  isSaving: boolean;
  item: ItemDef | null;
  itemDiagnostics: ReturnType<typeof validateItemCatalog>;
  itemIdDraft: string;
  onApplyItemId: () => void;
  onCategoryChange: (category: ItemDef["category"]) => void;
  onDefaultQuantityChange: (value: string) => void;
  onDescriptionChange: (description: string) => void;
  onEffectChange: (
    field: keyof NonNullable<ItemDef["effects"]>,
    value: string,
  ) => void;
  onItemIdDraftChange: (itemId: string) => void;
  onNameChange: (name: string) => void;
  onReset: () => void;
  onSave: () => void;
  saveStatus: SaveStatus;
  selectedRef: ContentRef;
}) {
  if (selectedRef.type !== CONTENT_TYPES.item) {
    return (
      <section className="editor-item-editor">
        <div className="editor-family__header">
          <h3>Item Draft</h3>
          <span>inactive</span>
        </div>
        <p className="editor-empty">Select an item.</p>
      </section>
    );
  }

  if (!item) {
    return (
      <section className="editor-item-editor">
        <div className="editor-family__header">
          <h3>Item Draft</h3>
          <span>missing</span>
        </div>
        <p className="editor-empty">Item not found.</p>
      </section>
    );
  }

  return (
    <section className="editor-item-editor" aria-label="Item draft editor">
      <div className="editor-family__header">
        <h3>Item Draft</h3>
        <span>{hasUnsavedChanges ? "dirty" : "clean"}</span>
      </div>

      <div className="editor-item-form">
        <label className="editor-field">
          <span>Item ID</span>
          <div className="editor-inline-control">
            <input
              disabled={isSaving}
              onChange={(event) => onItemIdDraftChange(event.target.value)}
              type="text"
              value={itemIdDraft}
            />
            <TerminalButton
              className="editor-compact-button"
              disabled={isSaving}
              onClick={onApplyItemId}
            >
              Apply
            </TerminalButton>
          </div>
        </label>

        <label className="editor-field">
          <span>Name</span>
          <input
            disabled={isSaving}
            onChange={(event) => onNameChange(event.target.value)}
            type="text"
            value={item.name}
          />
        </label>

        <label className="editor-field">
          <span>Description</span>
          <textarea
            disabled={isSaving}
            onChange={(event) => onDescriptionChange(event.target.value)}
            rows={4}
            value={item.description}
          />
        </label>

        <div className="editor-form-row">
          <label className="editor-field">
            <span>Category</span>
            <select
              disabled={isSaving}
              onChange={(event) =>
                onCategoryChange(event.target.value as ItemDef["category"])
              }
              value={item.category}
            >
              {ITEM_CATEGORY_OPTIONS.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </label>

          <label className="editor-field">
            <span>Default Qty</span>
            <input
              disabled={isSaving}
              min={0}
              onChange={(event) =>
                onDefaultQuantityChange(event.target.value)
              }
              step={1}
              type="number"
              value={item.defaultQuantity}
            />
          </label>
        </div>

        <div className="editor-form-row">
          <label className="editor-field">
            <span>Energy</span>
            <input
              disabled={isSaving}
              min={0}
              onChange={(event) =>
                onEffectChange("energyRestore", event.target.value)
              }
              step={1}
              type="number"
              value={item.effects?.energyRestore ?? ""}
            />
          </label>

          <label className="editor-field">
            <span>HP</span>
            <input
              disabled={isSaving}
              min={0}
              onChange={(event) =>
                onEffectChange("hpRestore", event.target.value)
              }
              step={1}
              type="number"
              value={item.effects?.hpRestore ?? ""}
            />
          </label>
        </div>

        {itemDiagnostics.length > 0 && (
          <ul className="editor-inline-diagnostics">
            {itemDiagnostics.map((diagnostic, index) => (
              <li
                className={`editor-diagnostic editor-diagnostic--${diagnostic.severity}`}
                key={`${diagnostic.path}-${index}`}
              >
                {formatContentDiagnostic(diagnostic)}
              </li>
            ))}
          </ul>
        )}

        <div className="editor-actions">
          <TerminalButton
            className="editor-action-button"
            disabled={!canSave}
            onClick={onSave}
          >
            Save Items
          </TerminalButton>
          <TerminalButton
            className="editor-action-button"
            disabled={!hasUnsavedChanges || isSaving}
            onClick={onReset}
          >
            Reset
          </TerminalButton>
        </div>

        <p
          aria-live="polite"
          className={`editor-save-status editor-save-status--${saveStatus.state}`}
        >
          {saveStatus.message}
        </p>
      </div>
    </section>
  );
}

function ReferenceList({
  emptyLabel,
  onSelectRef,
  references,
  title,
  useTarget,
}: {
  emptyLabel: string;
  onSelectRef: (ref: ContentRef) => void;
  references: ContentReference[];
  title: string;
  useTarget: boolean;
}) {
  return (
    <section className="editor-reference-list">
      <h3>{title}</h3>
      {references.length === 0 ? (
        <p className="editor-empty">{emptyLabel}</p>
      ) : (
        <ul>
          {references.map((reference, index) => {
            const linkedRef = useTarget ? reference.to : reference.from;
            return (
              <li key={`${reference.path}-${index}`}>
                <button
                  className="editor-reference-link"
                  onClick={() => onSelectRef(linkedRef)}
                  type="button"
                >
                  {formatContentRef(linkedRef)}
                </button>
                <span>{reference.path}</span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function parseNumberDraft(value: string): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function updateItemEffect(
  item: ItemDef,
  field: keyof NonNullable<ItemDef["effects"]>,
  value: string,
): ItemDef {
  const effects = { ...(item.effects ?? {}) };
  if (!value.trim()) {
    delete effects[field];
  } else {
    effects[field] = parseNumberDraft(value);
  }

  return {
    ...item,
    effects: Object.keys(effects).length > 0 ? effects : undefined,
  };
}
