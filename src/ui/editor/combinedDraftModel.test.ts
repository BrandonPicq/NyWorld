import { describe, expect, it } from "vitest";
import {
  createRuntimeContentCatalogSnapshot,
  createRuntimeContentValidationContext,
  validateAllContent,
  type NpcDef,
} from "../../engine";
import {
  createCombinedDraftSnapshot,
  createCombinedDraftValidationContext,
  type EditorDraftContents,
} from "./combinedDraftModel";
import { cloneDialogueFiles } from "./dialogues/dialogueEditorModel";

const base = createRuntimeContentCatalogSnapshot();
const baseContext = createRuntimeContentValidationContext();

const newNpc: NpcDef = {
  npcId: "combined_hero",
  name: "Combined Hero",
  race: "human",
  defaultDialogueId: "combined_hero.default",
};

function contentsWith(
  overrides: Partial<EditorDraftContents>,
): EditorDraftContents {
  return {
    dialogueFiles: cloneDialogueFiles(base.dialogueFiles),
    npcs: base.npcs,
    presence: base.npcPresence,
    enemies: base.enemies,
    items: base.items,
    actions: base.combatActions,
    quests: base.quests,
    game: base.game,
    ...overrides,
  };
}

describe("createCombinedDraftSnapshot", () => {
  it("lets one family's draft satisfy another family's reference", () => {
    const dialogueFiles = {
      ...cloneDialogueFiles(base.dialogueFiles),
      combined_hero: {
        "combined_hero.default": [
          { speaker: "Combined Hero", text: "Hello.", pitch: 1 },
        ],
      },
    };
    const contents = contentsWith({
      dialogueFiles,
      npcs: [...base.npcs, newNpc],
    });

    const diagnostics = validateAllContent(
      createCombinedDraftSnapshot(base, contents),
      createCombinedDraftValidationContext(baseContext, base, contents),
    );

    // The NPC's dialogue reference resolves against the unsaved dialogue draft.
    expect(
      diagnostics.some((diagnostic) => diagnostic.contentId === "combined_hero"),
    ).toBe(false);
  });

  it("still dangles when the referenced draft is absent (control)", () => {
    const contents = contentsWith({ npcs: [...base.npcs, newNpc] });

    const diagnostics = validateAllContent(
      createCombinedDraftSnapshot(base, contents),
      createCombinedDraftValidationContext(baseContext, base, contents),
    );

    expect(
      diagnostics.some(
        (diagnostic) =>
          diagnostic.contentId === "combined_hero" &&
          /combined_hero\.default/.test(diagnostic.message),
      ),
    ).toBe(true);
  });

  it("substitutes every family and stays audit-clean with no drafts", () => {
    const contents = contentsWith({});
    const diagnostics = validateAllContent(
      createCombinedDraftSnapshot(base, contents),
      createCombinedDraftValidationContext(baseContext, base, contents),
    );
    expect(
      diagnostics.filter((diagnostic) => diagnostic.severity === "error"),
    ).toEqual([]);
  });
});
