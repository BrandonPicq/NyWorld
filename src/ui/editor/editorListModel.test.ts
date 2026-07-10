import { describe, expect, it } from "vitest";
import {
  filterEditorListGroups,
  getEditorListGroupKeys,
  type EditorListGroupModel,
} from "./editorListModel";

type Entry = { key: string; id: string; name?: string };

const groups: EditorListGroupModel<Entry>[] = [
  {
    key: "zones",
    entries: [{ key: "zone:forest", id: "forest", name: "Forest" }],
  },
  {
    key: "items",
    entries: [
      { key: "item:ring", id: "ring", name: "Copper Ring" },
      { key: "item:herb", id: "herb", name: "Healing Herb" },
    ],
  },
];

describe("editor list groups", () => {
  it("filters entries by id or display name and hides empty groups", () => {
    expect(filterEditorListGroups(groups, "copper")).toEqual([
      {
        key: "items",
        entries: [{ key: "item:ring", id: "ring", name: "Copper Ring" }],
      },
    ]);
  });

  it("returns every group for an empty query", () => {
    expect(filterEditorListGroups(groups, " ")).toEqual(groups);
  });

  it("opens matching groups and the selected entry group", () => {
    expect(getEditorListGroupKeys(groups, "forest", "item:ring")).toEqual([
      "zones",
      "items",
    ]);
  });

  it("opens the selected group even without a search", () => {
    expect(getEditorListGroupKeys(groups, "", "item:ring")).toEqual([
      "items",
    ]);
  });
});
