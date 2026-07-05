import { describe, expect, it } from "vitest";

import { createRuntimeContentCatalogSnapshot } from "./runtimeContentCatalog";

describe("createRuntimeContentCatalogSnapshot", () => {
  it("returns a detached game config", () => {
    const first = createRuntimeContentCatalogSnapshot();

    first.game.newGame.startingInventory[0].quantity = 99;

    const second = createRuntimeContentCatalogSnapshot();
    expect(second.game.newGame.startingInventory[0].quantity).toBe(1);
  });

  it("returns detached dialogue file data", () => {
    const first = createRuntimeContentCatalogSnapshot();

    first.dialogueFiles.old_wizard["old_wizard.default"][0].text =
      "Changed outside the snapshot.";

    const second = createRuntimeContentCatalogSnapshot();
    expect(
      second.dialogueFiles.old_wizard["old_wizard.default"][0].text,
    ).toBe("Hocus Pocus! I am an adjacent Wizard.");
  });
});
