import { describe, expect, it } from "vitest";
import { splitIdentifierLabel } from "./IdentifierLabel";

describe("splitIdentifierLabel", () => {
  it("adds breakpoints after common identifier separators", () => {
    expect(
      splitIdentifierLabel("old_scholar.advanced_quest_complete"),
    ).toEqual([
      { text: "old_", breakAfter: true },
      { text: "scholar.", breakAfter: true },
      { text: "advanced_", breakAfter: true },
      { text: "quest_", breakAfter: true },
      { text: "complete", breakAfter: false },
    ]);
  });

  it("keeps ids without separators as one chunk", () => {
    expect(splitIdentifierLabel("goblin")).toEqual([
      { text: "goblin", breakAfter: false },
    ]);
  });

  it("keeps repeated separators with the preceding chunk", () => {
    expect(splitIdentifierLabel("npc::old_scholar")).toEqual([
      { text: "npc::", breakAfter: true },
      { text: "old_", breakAfter: true },
      { text: "scholar", breakAfter: false },
    ]);
  });
});
