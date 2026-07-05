import { describe, expect, it } from "vitest";

import { createRuntimeContentCatalogSnapshot } from "./runtimeContentCatalog";

describe("createRuntimeContentCatalogSnapshot", () => {
  it("returns a detached game config", () => {
    const first = createRuntimeContentCatalogSnapshot();
    const authoredInventoryLength = first.game.newGame.startingInventory.length;

    first.game.newGame.startingInventory.push({
      itemId: "external_item",
      quantity: 99,
    });

    const second = createRuntimeContentCatalogSnapshot();
    expect(second.game.newGame.startingInventory).toHaveLength(
      authoredInventoryLength,
    );
  });

  it("returns detached dialogue file data", () => {
    const first = createRuntimeContentCatalogSnapshot();
    const dialogue = getFirstEditableDialogue(first.dialogueFiles);

    first.dialogueFiles[dialogue.stem][dialogue.dialogueId][0].text =
      "Changed outside the snapshot.";

    const second = createRuntimeContentCatalogSnapshot();
    expect(second.dialogueFiles[dialogue.stem][dialogue.dialogueId]).toEqual(
      dialogue.nodes,
    );
  });
});

function getFirstEditableDialogue(
  files: ReturnType<typeof createRuntimeContentCatalogSnapshot>["dialogueFiles"],
) {
  for (const stem of Object.keys(files).sort((a, b) => a.localeCompare(b))) {
    const dialogueIds = Object.keys(files[stem]).sort((a, b) =>
      a.localeCompare(b),
    );
    const dialogueId = dialogueIds[0];
    if (dialogueId) {
      return {
        stem,
        dialogueId,
        nodes: files[stem][dialogueId].map((node) => ({ ...node })),
      };
    }
  }

  throw new Error("expected at least one editable dialogue file");
}
