import { describe, expect, it } from "vitest";

import { filterByIdOrName } from "./listFilter";

describe("filterByIdOrName", () => {
  const entries = [
    { id: "old_scholar", name: "Old Scholar" },
    { id: "academy_notebook", name: "Academy Notebook" },
    { id: "test_zone", name: "Tutorial Field" },
  ];

  it("matches entries by id or display name case-insensitively", () => {
    expect(filterByIdOrName(entries, "SCHOLAR")).toEqual([entries[0]]);
    expect(filterByIdOrName(entries, "note")).toEqual([entries[1]]);
    expect(filterByIdOrName(entries, "field")).toEqual([entries[2]]);
  });

  it("returns all entries for blank queries", () => {
    expect(filterByIdOrName(entries, "   ")).toEqual(entries);
  });
});
