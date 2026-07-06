export type IdNameFilterEntry = {
  id: string;
  name?: string | null;
};

export function filterByIdOrName<T extends IdNameFilterEntry>(
  entries: readonly T[],
  query: string,
): T[] {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) {
    return [...entries];
  }

  return entries.filter((entry) => {
    const id = entry.id.toLowerCase();
    const name = (entry.name ?? "").toLowerCase();
    return id.includes(normalizedQuery) || name.includes(normalizedQuery);
  });
}
