const KEYBOARD_BLOCKING_HOVER_SELECTOR =
  '[data-keyboard-blocking-hover="true"]:hover:not(:disabled):not([aria-disabled="true"])';

type KeyboardEventLike = {
  preventDefault: () => void;
  stopPropagation: () => void;
};

export function isPointerOverKeyboardBlockingElement(
  documentRef: Document | undefined = typeof document === "undefined"
    ? undefined
    : document,
): boolean {
  return (
    documentRef?.querySelector(KEYBOARD_BLOCKING_HOVER_SELECTOR) !== null
  );
}

export function consumeIfPointerOverKeyboardBlockingElement(
  event: KeyboardEventLike,
  documentRef?: Document,
): boolean {
  if (!isPointerOverKeyboardBlockingElement(documentRef)) {
    return false;
  }

  event.preventDefault();
  event.stopPropagation();
  return true;
}

export function isPointerLockedMenuKey(key: string): boolean {
  return (
    key === "ArrowDown" ||
    key === "ArrowUp" ||
    key === "ArrowLeft" ||
    key === "ArrowRight" ||
    key === "Enter" ||
    key === " " ||
    key === "Spacebar" ||
    /^[1-9]$/.test(key)
  );
}
