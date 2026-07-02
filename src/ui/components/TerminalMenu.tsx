import { useEffect, useMemo, useRef, useState } from "react";
import {
  getFirstEnabledMenuItemIndex,
  getNextEnabledMenuItemIndex,
  type MenuItem,
} from "../menu/menuNavigation";
import { TerminalButton } from "./TerminalButton";

export type TerminalMenuItem = MenuItem;

type TerminalMenuProps = {
  ariaLabel: string;
  items: TerminalMenuItem[];
  className?: string;
  onActivateItem?: () => void;
  onBack?: () => void;
  onBackAction?: () => void;
  onMoveSelection?: () => void;
};

export function TerminalMenu({
  ariaLabel,
  items,
  className,
  onActivateItem,
  onBack,
  onBackAction,
  onMoveSelection,
}: TerminalMenuProps) {
  const buttonRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const firstEnabledIndex = useMemo(
    () => getFirstEnabledMenuItemIndex(items),
    [items],
  );
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(firstEnabledIndex);
  const classes = ["terminal-menu", className].filter(Boolean).join(" ");

  useEffect(() => {
    if (selectedIndex < 0 || items[selectedIndex]?.disabled) {
      setSelectedIndex(firstEnabledIndex);
    }
  }, [firstEnabledIndex, items, selectedIndex]);

  useEffect(() => {
    if (
      hoveredIndex !== null &&
      (hoveredIndex >= items.length || items[hoveredIndex]?.disabled)
    ) {
      setHoveredIndex(null);
    }
  }, [hoveredIndex, items]);

  useEffect(() => {
    if (selectedIndex >= 0) {
      buttonRefs.current[selectedIndex]?.focus();
    }
  }, [items, selectedIndex]);

  function moveSelection(direction: -1 | 1) {
    const nextIndex = getNextEnabledMenuItemIndex(
      items,
      selectedIndex,
      direction,
    );

    if (nextIndex !== selectedIndex) {
      setSelectedIndex(nextIndex);
      onMoveSelection?.();
    }
  }

  function activateMenuItem(item: TerminalMenuItem | undefined) {
    if (!item || item.disabled) {
      return;
    }

    onActivateItem?.();
    item.onSelect?.();
  }

  function activateSelectedItem() {
    activateMenuItem(items[selectedIndex]);
  }

  function handleBackAction(event: React.KeyboardEvent<HTMLElement>) {
    if (!onBack) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    onBackAction?.();
    onBack();
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLElement>) {
    if (hoveredIndex !== null && isPointerLockedMenuKey(event.key)) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    if (event.key === "Tab") {
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      event.stopPropagation();
      moveSelection(1);
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      event.stopPropagation();
      moveSelection(-1);
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      event.stopPropagation();
      activateSelectedItem();
      return;
    }

    if (event.key === "ArrowLeft") {
      const selectedItem = items[selectedIndex];
      if (selectedItem?.onLeft && !selectedItem.disabled) {
        event.preventDefault();
        event.stopPropagation();
        selectedItem.onLeft();
        onMoveSelection?.();
      }
      return;
    }

    if (event.key === "ArrowRight") {
      const selectedItem = items[selectedIndex];
      if (selectedItem?.onRight && !selectedItem.disabled) {
        event.preventDefault();
        event.stopPropagation();
        selectedItem.onRight();
        onMoveSelection?.();
      }
      return;
    }

    if (event.key === "Escape") {
      handleBackAction(event);
    }
  }

  return (
    <nav className={classes} aria-label={ariaLabel} onKeyDown={handleKeyDown}>
      {items.map((item, index) => {
        const isSelected = index === selectedIndex && !item.disabled;

        return (
          <TerminalButton
            disabled={item.disabled}
            isSelected={isSelected}
            key={`${item.label}-${index}`}
            onClick={() => activateMenuItem(item)}
            onFocus={() => {
              if (!item.disabled) {
                setSelectedIndex(index);
              }
            }}
            onMouseEnter={() => {
              if (!item.disabled) {
                setHoveredIndex(index);
                setSelectedIndex(index);
              }
            }}
            onMouseLeave={() => {
              setHoveredIndex((currentIndex) =>
                currentIndex === index ? null : currentIndex,
              );
            }}
            ref={(button) => {
              buttonRefs.current[index] = button;
            }}
            tabIndex={isSelected ? 0 : -1}
          >
            {item.label}
          </TerminalButton>
        );
      })}
    </nav>
  );
}

function isPointerLockedMenuKey(key: string): boolean {
  return (
    key === "ArrowDown" ||
    key === "ArrowUp" ||
    key === "ArrowLeft" ||
    key === "ArrowRight" ||
    key === "Enter" ||
    key === " " ||
    key === "Spacebar"
  );
}
