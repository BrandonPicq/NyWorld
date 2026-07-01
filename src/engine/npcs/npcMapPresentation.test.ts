import { describe, expect, it } from "vitest";
import {
  COMMON_NPC_GLYPH,
  getNpcMapPresentation,
} from "./npcMapPresentation";

describe("npcMapPresentation", () => {
  it("uses a shared glyph and race color for common NPCs", () => {
    expect(
      getNpcMapPresentation({ race: "human", importance: "common" }),
    ).toEqual({
      glyph: COMMON_NPC_GLYPH,
      color: "#f2cdcd",
    });

    expect(
      getNpcMapPresentation({ race: "elf", importance: "common" }),
    ).toEqual({
      glyph: COMMON_NPC_GLYPH,
      color: "#a6e3a1",
    });
  });

  it("allows presentation overrides only for important NPCs", () => {
    const presentation = { glyph: "S", color: "#ffcc00" };

    expect(
      getNpcMapPresentation({
        race: "human",
        importance: "common",
        presentation,
      }),
    ).toEqual({
      glyph: COMMON_NPC_GLYPH,
      color: "#f2cdcd",
    });

    expect(
      getNpcMapPresentation({
        race: "human",
        importance: "story",
        presentation,
      }),
    ).toEqual(presentation);
  });
});
