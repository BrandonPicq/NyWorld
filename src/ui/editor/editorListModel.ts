import { filterByIdOrName } from "./listFilter";

export type EditorListEntryModel = {
  key: string;
  id: string;
  name?: string | null;
};

export type EditorListGroupModel<T extends EditorListEntryModel> = {
  key: string;
  entries: readonly T[];
};

export type FilteredEditorListGroup<T extends EditorListEntryModel> =
  EditorListGroupModel<T> & {
    entries: T[];
  };

export function filterEditorListGroups<T extends EditorListEntryModel>(
  groups: readonly EditorListGroupModel<T>[],
  query: string,
): FilteredEditorListGroup<T>[] {
  return groups
    .map((group) => ({
      ...group,
      entries: filterByIdOrName(group.entries, query),
    }))
    .filter((group) => group.entries.length > 0 || !query.trim());
}
export function getEditorListGroupKeys<T extends EditorListEntryModel>(
  groups: readonly EditorListGroupModel<T>[],
  query: string,
  selectedEntryKey?: string,
): string[] {
  const filteredGroups = filterEditorListGroups(groups, query);
  const matchingKeys = query.trim()
    ? filteredGroups.map((group) => group.key)
    : [];
  const selectedGroup = groups.find((group) =>
    group.entries.some((entry) => entry.key === selectedEntryKey),
  );

  return Array.from(
    new Set(
      selectedGroup ? [...matchingKeys, selectedGroup.key] : matchingKeys,
    ),
  );
}
