import { describe, expect, it } from "vitest";

import { createRuntimeContentCatalogSnapshot } from "./runtimeContentCatalog";

describe("createRuntimeContentCatalogSnapshot", () => {
  it("returns a detached game config", () => {
    const first = createRuntimeContentCatalogSnapshot();

    first.game.newGame.startingInventory[0].quantity = 99;

    const second = createRuntimeContentCatalogSnapshot();
    expect(second.game.newGame.startingInventory[0].quantity).toBe(1);
  });
});
