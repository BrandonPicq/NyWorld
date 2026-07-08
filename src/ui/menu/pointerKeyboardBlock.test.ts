import { describe, expect, it, vi } from "vitest";
import {
  consumeIfPointerOverKeyboardBlockingElement,
  isPointerLockedMenuKey,
  isPointerOverKeyboardBlockingElement,
} from "./pointerKeyboardBlock";

describe("pointer keyboard block", () => {
  it("detects hovered keyboard-blocking elements", () => {
    expect(
      isPointerOverKeyboardBlockingElement(documentWithHoveredElement(true)),
    ).toBe(true);
    expect(
      isPointerOverKeyboardBlockingElement(documentWithHoveredElement(false)),
    ).toBe(false);
  });

  it("consumes an event only while a blocking element is hovered", () => {
    const event = {
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    };

    expect(
      consumeIfPointerOverKeyboardBlockingElement(
        event,
        documentWithHoveredElement(true),
      ),
    ).toBe(true);
    expect(event.preventDefault).toHaveBeenCalledTimes(1);
    expect(event.stopPropagation).toHaveBeenCalledTimes(1);

    expect(
      consumeIfPointerOverKeyboardBlockingElement(
        event,
        documentWithHoveredElement(false),
      ),
    ).toBe(false);
    expect(event.preventDefault).toHaveBeenCalledTimes(1);
    expect(event.stopPropagation).toHaveBeenCalledTimes(1);
  });

  it("recognizes menu navigation keys", () => {
    expect(isPointerLockedMenuKey("ArrowDown")).toBe(true);
    expect(isPointerLockedMenuKey("Enter")).toBe(true);
    expect(isPointerLockedMenuKey("3")).toBe(true);
    expect(isPointerLockedMenuKey("Escape")).toBe(false);
    expect(isPointerLockedMenuKey("x")).toBe(false);
  });
});

function documentWithHoveredElement(hasElement: boolean): Document {
  return {
    querySelector: vi.fn(() => (hasElement ? {} : null)),
  } as unknown as Document;
}
