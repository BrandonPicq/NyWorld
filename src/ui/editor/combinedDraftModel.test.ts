import { describe, expect, it } from "vitest";
import {
  buildContentReferenceGraph,
  CONTENT_TYPES,
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

  it("clones the game config so mutating the snapshot cannot corrupt the draft", () => {
    const contents = contentsWith({});
    const snapshot = createCombinedDraftSnapshot(base, contents);

    snapshot.game.newGame.startingInventory[0].quantity = 999;

    const fresh = createCombinedDraftSnapshot(base, contents);
    expect(fresh.game.newGame.startingInventory[0].quantity).not.toBe(999);
  });
});

describe("createCombinedDraftSnapshot reference graph", () => {
  const dialogueId = "combined_hero.default";

  function dialogueFilesWithHero() {
    return {
      ...cloneDialogueFiles(base.dialogueFiles),
      combined_hero: {
        [dialogueId]: [
          { speaker: "Combined Hero", text: "Hello.", pitch: 1 },
        ],
      },
    };
  }

  it("reports no references before an NPC points at a fresh dialogue", () => {
    const contents = contentsWith({ dialogueFiles: dialogueFilesWithHero() });
    const graph = buildContentReferenceGraph(
      createCombinedDraftSnapshot(base, contents),
    );
    expect(
      graph.getReferencesTo({ type: CONTENT_TYPES.dialogue, id: dialogueId }),
    ).toEqual([]);
  });

  it("blocks a delete the moment a draft reference is added", () => {
    // Mirrors the synchronous delete re-check: a graph freshly built from the
    // live combined snapshot must see a just-added reference.
    const contents = contentsWith({
      dialogueFiles: dialogueFilesWithHero(),
      npcs: [...base.npcs, newNpc],
    });
    const graph = buildContentReferenceGraph(
      createCombinedDraftSnapshot(base, contents),
    );
    expect(
      graph.getReferencesTo({ type: CONTENT_TYPES.dialogue, id: dialogueId })
        .length,
    ).toBeGreaterThan(0);
  });
});
