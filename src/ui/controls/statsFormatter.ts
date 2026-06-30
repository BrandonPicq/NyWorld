export function formatCurrency(bronzeCoins: number): string {
  const platinum = Math.floor(bronzeCoins / 1000000);
  const gold = Math.floor((bronzeCoins % 1000000) / 10000);
  const silver = Math.floor((bronzeCoins % 10000) / 100);
  const bronze = bronzeCoins % 100;

  const parts: string[] = [];
  if (platinum > 0) parts.push(`${platinum}p`);
  if (gold > 0) parts.push(`${gold}g`);
  if (silver > 0) parts.push(`${silver}s`);
  if (bronze > 0 || parts.length === 0) parts.push(`${bronze}b`);

  return parts.join(" ");
}

export function capitalize(str: string): string {
  if (!str) return "";
  return str.charAt(0).toUpperCase() + str.slice(1);
}
