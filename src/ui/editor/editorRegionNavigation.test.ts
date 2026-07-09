import { describe, expect, it } from "vitest";
import {
  controlOwnsVerticalArrowKeys,
  getNextEditorRegionIndex,
  isEditorFocusRecoveryKey,
  resolveEditorRegionKeyAction,
} from "./editorRegionNavigation";

describe("editor region navigation", () => {
  it("maps arrows to region movement", () => {
    expect(resolveEditorRegionKeyAction("ArrowLeft", { regionCount: 3 })).toEqual({
      kind: "move",
      direction: -1,
    });
    expect(resolveEditorRegionKeyAction("ArrowUp", { regionCount: 3 })).toEqual({
      kind: "move",
      direction: -1,
    });
    expect(resolveEditorRegionKeyAction("ArrowRight", { regionCount: 3 })).toEqual({
      kind: "move",
      direction: 1,
    });
    expect(resolveEditorRegionKeyAction("ArrowDown", { regionCount: 3 })).toEqual({
      kind: "move",
      direction: 1,
    });
  });

  it("maps Enter and Escape to hierarchy actions", () => {
    expect(resolveEditorRegionKeyAction("Enter", { regionCount: 3 })).toEqual({
      kind: "enter",
    });
    expect(resolveEditorRegionKeyAction("Escape", { regionCount: 3 })).toEqual({
      kind: "previous",
    });
  });

  it("ignores region movement when no region exists", () => {
    expect(resolveEditorRegionKeyAction("ArrowRight", { regionCount: 0 })).toEqual({
      kind: "none",
    });
    expect(resolveEditorRegionKeyAction("x", { regionCount: 3 })).toEqual({
      kind: "none",
    });
  });

  it("recovers focus on navigation keys only", () => {
    expect(isEditorFocusRecoveryKey("ArrowDown")).toBe(true);
    expect(isEditorFocusRecoveryKey("ArrowLeft")).toBe(true);
    expect(isEditorFocusRecoveryKey("Enter")).toBe(true);
    expect(isEditorFocusRecoveryKey("Escape")).toBe(true);
    expect(isEditorFocusRecoveryKey("a")).toBe(false);
    expect(isEditorFocusRecoveryKey("Tab")).toBe(false);
  });

  it("leaves vertical arrows to controls that need them to operate", () => {
    expect(controlOwnsVerticalArrowKeys("TEXTAREA", null)).toBe(true);
    expect(controlOwnsVerticalArrowKeys("INPUT", "range")).toBe(true);
    expect(controlOwnsVerticalArrowKeys("INPUT", "radio")).toBe(true);
    expect(controlOwnsVerticalArrowKeys("INPUT", "text")).toBe(false);
    expect(controlOwnsVerticalArrowKeys("INPUT", null)).toBe(false);
    expect(controlOwnsVerticalArrowKeys("BUTTON", null)).toBe(false);
    // Arrows must not change these while merely passing over them.
    expect(controlOwnsVerticalArrowKeys("SELECT", null)).toBe(false);
    expect(controlOwnsVerticalArrowKeys("INPUT", "number")).toBe(false);
  });

  it("wraps region indexes", () => {
    expect(getNextEditorRegionIndex(0, 3, -1)).toBe(2);
    expect(getNextEditorRegionIndex(2, 3, 1)).toBe(0);
    expect(getNextEditorRegionIndex(1, 3, 1)).toBe(2);
    expect(getNextEditorRegionIndex(0, 0, 1)).toBe(-1);
  });
});
