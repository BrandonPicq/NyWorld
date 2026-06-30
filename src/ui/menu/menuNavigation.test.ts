import { describe, expect, it } from "vitest";
import {
  getFirstEnabledMenuItemIndex,
  getNextEnabledMenuItemIndex,
  type MenuItem,
} from "./menuNavigation";

const menuItems: MenuItem[] = [
  { label: "New Game" },
  { label: "Load Game", disabled: true },
  { label: "Options", disabled: true },
  { label: "Quit" },
];

describe("menu navigation", () => {
  it("selects the first enabled item by default", () => {
    expect(getFirstEnabledMenuItemIndex(menuItems)).toBe(0);
  });

  it("skips disabled items when moving down", () => {
    expect(getNextEnabledMenuItemIndex(menuItems, 0, 1)).toBe(3);
  });

  it("skips disabled items when moving up", () => {
    expect(getNextEnabledMenuItemIndex(menuItems, 3, -1)).toBe(0);
  });

  it("wraps across enabled items", () => {
    expect(getNextEnabledMenuItemIndex(menuItems, 3, 1)).toBe(0);
    expect(getNextEnabledMenuItemIndex(menuItems, 0, -1)).toBe(3);
  });

  it("returns no selection when every item is disabled", () => {
    expect(
      getNextEnabledMenuItemIndex(
        [
          { label: "Load Game", disabled: true },
          { label: "Options", disabled: true },
        ],
        0,
        1,
      ),
    ).toBe(-1);
  });
});
