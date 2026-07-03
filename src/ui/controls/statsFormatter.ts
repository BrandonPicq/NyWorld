/**
 * Formats the smallest currency unit into medieval coin denominations.
 */
export function formatCurrency(copperCoins: number): string {
  const platinum = Math.floor(copperCoins / 1000000);
  const gold = Math.floor((copperCoins % 1000000) / 10000);
  const silver = Math.floor((copperCoins % 10000) / 100);
  const copper = copperCoins % 100;

  const parts: string[] = [];
  if (platinum > 0) parts.push(`${platinum}p`);
  if (gold > 0) parts.push(`${gold}g`);
  if (silver > 0) parts.push(`${silver}s`);
  if (copper > 0 || parts.length === 0) parts.push(`${copper}c`);

  return parts.join(" ");
}

/**
 * Capitalizes labels generated from data keys without changing the rest of the word.
 */
export function capitalize(str: string): string {
  if (!str) return "";
  return str.charAt(0).toUpperCase() + str.slice(1);
}
