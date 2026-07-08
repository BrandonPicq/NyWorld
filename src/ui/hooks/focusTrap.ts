import {
  useCallback,
  useEffect,
  type KeyboardEvent as ReactKeyboardEvent,
  type RefObject,
} from "react";

const FOCUSABLE_SELECTOR = [
  "button:not([disabled])",
  "[href]",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

type FocusTrapOptions = {
  containerRef: RefObject<HTMLElement | null>;
  initialFocusRef?: RefObject<HTMLElement | null>;
  isActive?: boolean;
  onEscape?: () => void;
};

export function useFocusTrap({
  containerRef,
  initialFocusRef,
  isActive = true,
  onEscape,
}: FocusTrapOptions) {
  useEffect(() => {
    if (!isActive) {
      return;
    }

    const previousFocus = document.activeElement;
    const target =
      initialFocusRef?.current ??
      getFocusableElements(containerRef.current)[0] ??
      containerRef.current;
    target?.focus();

    return () => {
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) {
        previousFocus.focus();
      }
    };
  }, [containerRef, initialFocusRef, isActive]);

  const handleKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLElement> | KeyboardEvent) => {
      if (!isActive) {
        return;
      }

      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        onEscape?.();
        return;
      }

      if (event.key !== "Tab") {
        return;
      }

      const focusable = getFocusableElements(containerRef.current);
      if (focusable.length === 0) {
        event.preventDefault();
        event.stopPropagation();
        containerRef.current?.focus();
        return;
      }

      const currentIndex = focusable.indexOf(
        document.activeElement as HTMLElement,
      );
      const nextIndex = getNextFocusTrapIndex(
        currentIndex,
        focusable.length,
        event.shiftKey ? -1 : 1,
      );

      event.preventDefault();
      event.stopPropagation();
      focusable[nextIndex]?.focus();
    },
    [containerRef, isActive, onEscape],
  );

  return { handleKeyDown };
}

export function getFocusableElements(
  container: HTMLElement | null,
): HTMLElement[] {
  if (!container) {
    return [];
  }

  return Array.from(
    container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
  ).filter(isVisibleFocusableElement);
}

function isVisibleFocusableElement(element: HTMLElement): boolean {
  const style =
    element.ownerDocument.defaultView?.getComputedStyle(element) ?? null;
  return style?.display !== "none" && style?.visibility !== "hidden";
}

export function getNextFocusTrapIndex(
  currentIndex: number,
  itemCount: number,
  direction: -1 | 1,
): number {
  if (itemCount <= 0) {
    return -1;
  }
  if (currentIndex < 0) {
    return direction === 1 ? 0 : itemCount - 1;
  }
  return (currentIndex + direction + itemCount) % itemCount;
}
