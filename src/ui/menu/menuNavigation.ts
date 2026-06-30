export type MenuItem = {
  label: string;
  onSelect?: () => void;
  onLeft?: () => void;
  onRight?: () => void;
  disabled?: boolean;
};

export function getFirstEnabledMenuItemIndex(items: MenuItem[]) {
  return items.findIndex((item) => !item.disabled);
}

export function getNextEnabledMenuItemIndex(
  items: MenuItem[],
  currentIndex: number,
  direction: -1 | 1,
) {
  const enabledIndexes = items
    .map((item, index) => (!item.disabled ? index : -1))
    .filter((index) => index >= 0);

  if (enabledIndexes.length === 0) {
    return -1;
  }

  const currentEnabledPosition = enabledIndexes.indexOf(currentIndex);

  if (currentEnabledPosition === -1) {
    return direction === 1
      ? enabledIndexes[0]
      : enabledIndexes[enabledIndexes.length - 1];
  }

  const nextPosition =
    (currentEnabledPosition + direction + enabledIndexes.length) %
    enabledIndexes.length;

  return enabledIndexes[nextPosition];
}
