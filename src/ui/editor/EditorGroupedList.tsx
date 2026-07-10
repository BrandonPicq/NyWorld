import { useMemo, useState, type ReactNode } from "react";
import { ScrollRegion } from "../components/ScrollRegion";
import { EditorButton } from "./components/EditorButton";
import { ListFilterField } from "./ListFilterField";
import {
  filterEditorListGroups,
  getEditorListGroupKeys,
  type EditorListEntryModel,
  type EditorListGroupModel,
} from "./editorListModel";

export type EditorGroupedListEntry = EditorListEntryModel & {
  label: ReactNode;
  meta?: ReactNode;
  isUnsaved?: boolean;
  data?: unknown;
};

export type EditorGroupedListGroup = EditorListGroupModel<EditorGroupedListEntry> & {
  label: string;
};

type EditorGroupedListProps = {
  groups: readonly EditorGroupedListGroup[];
  filter: string;
  onFilterChange: (value: string) => void;
  selectedEntryKey?: string;
  onSelect: (entry: EditorGroupedListEntry) => void;
  emptyLabel: string;
  scrollGroups?: boolean;
};

export function EditorGroupedList({
  groups,
  filter,
  onFilterChange,
  selectedEntryKey,
  onSelect,
  emptyLabel,
  scrollGroups = false,
}: EditorGroupedListProps) {
  const filteredGroups = useMemo(
    () =>
      filterEditorListGroups(groups, filter).map((group) => ({
        ...group,
        label: groups.find((candidate) => candidate.key === group.key)?.label ?? group.key,
      })),
    [filter, groups],
  );
  const selectedGroupKeys = useMemo(
    () => getEditorListGroupKeys(groups, filter, selectedEntryKey),
    [filter, groups, selectedEntryKey],
  );
  const [openGroupKeys, setOpenGroupKeys] = useState<string[]>(() =>
    getEditorListGroupKeys(groups, filter, selectedEntryKey),
  );

  const openKeys = new Set([
    ...openGroupKeys,
    ...selectedGroupKeys,
  ]);

  function toggleGroup(groupKey: string): void {
    setOpenGroupKeys((current) =>
      current.includes(groupKey)
        ? current.filter((key) => key !== groupKey)
        : [...current, groupKey],
    );
  }

  const groupList = (
    <div className="editor-grouped-list" role="list">
        {filteredGroups.length === 0 ? (
          <p className="editor-empty">{emptyLabel}</p>
        ) : null}
        {filteredGroups.map((group) => {
          const isOpen = openKeys.has(group.key);
          return (
            <section className="editor-list-group" key={group.key}>
              <button
                aria-expanded={isOpen}
                className="editor-list-group__toggle"
                onClick={() => toggleGroup(group.key)}
                type="button"
              >
                <span aria-hidden="true" className="editor-list-group__chevron">
                  {isOpen ? "-" : "+"}
                </span>
                <span>{group.label}</span>
                <span className="editor-list-group__count">
                  {group.entries.length}
                </span>
              </button>
              {isOpen ? (
                <div className="editor-entry-list">
                  {group.entries.map((entry) => (
                    <EditorButton
                      className="editor-entry-button"
                      isSelected={entry.key === selectedEntryKey}
                      key={entry.key}
                      onClick={() => onSelect(entry)}
                    >
                      <span className="editor-list-entry">
                        <span className="editor-list-entry__label">
                          {entry.label}
                          {entry.isUnsaved ? " *" : ""}
                        </span>
                        {entry.meta ? (
                          <span className="editor-list-entry__meta">
                            {entry.meta}
                          </span>
                        ) : null}
                      </span>
                    </EditorButton>
                  ))}
                </div>
              ) : null}
            </section>
          );
        })}
    </div>
  );

  return (
    <>
      <ListFilterField
        label="Search"
        onChange={onFilterChange}
        value={filter}
      />
      {scrollGroups ? (
        <ScrollRegion className="editor-scroll">{groupList}</ScrollRegion>
      ) : (
        groupList
      )}
    </>
  );
}
