import { useState } from "react";
import type { ItemDef } from "../../engine";
import { IdentifierLabel } from "../components/IdentifierLabel";
import { ScrollRegion } from "../components/ScrollRegion";
import { TerminalButton } from "../components/TerminalButton";
import { TerminalPanel } from "../components/TerminalPanel";
import {
  DiagnosticList,
  type EditorContentNavigationTarget,
} from "./DiagnosticList";
import { refsEqual } from "./editorModel";
import { ItemDraftEditor } from "./ItemDraftEditor";
import { ListFilterField } from "./ListFilterField";
import { filterByIdOrName } from "./listFilter";
import { ReferenceList } from "./ReferenceList";
import type { ItemDraftController } from "./useItemDraft";

type ContentTabProps = {
  draft: ItemDraftController;
  onNavigate: (target: EditorContentNavigationTarget) => void;
};

export function ContentTab({ draft, onNavigate }: ContentTabProps) {
  const [listFilter, setListFilter] = useState("");
  const {
    browserGroups,
    diagnosticGroups,
    selectedRef,
    setSelectedRef,
    selectedImpact,
    incomingRefs,
    outgoingRefs,
    errorCount,
    warningCount,
    itemDraftErrorCount,
    totalEntries,
    hasUnsavedChanges,
    updateSelectedItem,
  } = draft;
  const filteredBrowserGroups = browserGroups
    .map((group) => ({
      ...group,
      entries: filterByIdOrName(
        group.entries.map((entry) => ({
          ...entry,
          id: entry.ref.id,
          name: entry.searchName ?? entry.label,
        })),
        listFilter,
      ),
    }))
    .filter((group) => group.entries.length > 0 || !listFilter.trim());

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

      <div className="workbench workbench--content-layout">
        <div className="workbench__main">
          <TerminalPanel className="editor-panel editor-browser" style={{ flex: 2, minHeight: 0 }}>
            <h2 className="editor-panel__title">Content</h2>
            <ListFilterField
              label="Filter"
              onChange={setListFilter}
              value={listFilter}
            />
            <ScrollRegion className="editor-scroll" role="list">
              {filteredBrowserGroups.length === 0 ? (
                <p className="editor-empty">No matching entries.</p>
              ) : null}
              {filteredBrowserGroups.map((group) => (
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
                        <IdentifierLabel value={entry.label} />
                      </TerminalButton>
                    ))}
                  </div>
                </section>
              ))}
            </ScrollRegion>
          </TerminalPanel>

          <TerminalPanel className="editor-panel editor-problems" style={{ flex: 1, minHeight: 0 }}>
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
                    <DiagnosticList
                      diagnostics={group.diagnostics}
                      onNavigate={onNavigate}
                    />
                  </section>
                ))}
              </ScrollRegion>
            )}
          </TerminalPanel>
        </div>

        <ScrollRegion className="workbench__inspector">
          <TerminalPanel className="editor-panel editor-reference">
            <h2 className="editor-panel__title">Editor</h2>
            <ItemDraftEditor
              canSave={draft.canSaveItems}
              isSaving={draft.isSaving}
              item={draft.selectedItem}
              itemDiagnostics={draft.selectedItemDiagnostics}
              itemIdDraft={draft.itemIdDraft}
              onApplyItemId={draft.renameSelectedItem}
              onCategoryChange={(category) =>
                updateSelectedItem((item) => updateItemCategory(item, category))
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
                updateSelectedItem((item) => updateItemEffect(item, field, value))
              }
              onUpdateItem={updateSelectedItem}
              onItemIdDraftChange={draft.setItemIdDraft}
              onNameChange={(name) =>
                updateSelectedItem((item) => ({ ...item, name }))
              }
              onReset={draft.resetItemDraft}
              onSave={draft.saveItemDraft}
              saveStatus={draft.saveStatus}
              selectedRef={selectedRef}
              hasUnsavedChanges={hasUnsavedChanges}
            />

            <h2 className="editor-panel__title">References</h2>
            <div className="editor-selected-ref">
              <span>{selectedRef.type}</span>
              <strong>{selectedRef.id}</strong>
            </div>

            <div className="editor-impact">
              <p>Rename impact: {selectedImpact.references.length} references</p>
              <p>
                Save persistence: {selectedImpact.appearsInSaves ? "yes" : "no"}
              </p>
            </div>

            <div className="editor-reference-columns">
              <ReferenceList
                emptyLabel="No incoming references."
                onNavigate={onNavigate}
                references={incomingRefs}
                title="Incoming"
                useTarget={false}
              />
              <ReferenceList
                emptyLabel="No outgoing references."
                onNavigate={onNavigate}
                references={outgoingRefs}
                title="Outgoing"
                useTarget
              />
            </div>
          </TerminalPanel>
        </ScrollRegion>
      </div>
    </>
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
  } else if (field === "teachesPatternId") {
    effects[field] = value.trim();
  } else {
    effects[field] = parseNumberDraft(value);
  }

  return {
    ...item,
    effects: Object.keys(effects).length > 0 ? effects : undefined,
  };
}

function updateItemCategory(
  item: ItemDef,
  category: ItemDef["category"],
): ItemDef {
  if (category === "equipment") {
    return {
      ...item,
      category,
      equipment: item.equipment ?? {
        slot: "weapon",
        weaponType: "sword",
        bonuses: { "combat.attack": 1 },
      },
    };
  }

  return { ...item, category, equipment: undefined };
}
