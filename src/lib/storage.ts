export type MinimalGroup = { name: string; [k: string]: unknown };

export const listCreatedGroupsForEvent = (slug: string): MinimalGroup[] => {
  if (typeof window === "undefined") return [] as MinimalGroup[];
  let merged: MinimalGroup[] = [];
  try {
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (!key) continue;
      if (key.startsWith(`createdGroups:${slug}:`)) {
        const raw = window.localStorage.getItem(key);
        if (raw) merged = merged.concat(JSON.parse(raw) as MinimalGroup[]);
      }
    }
    const legacy = window.localStorage.getItem(`createdGroups:${slug}`);
    if (legacy) merged = merged.concat(JSON.parse(legacy) as MinimalGroup[]);
  } catch {}
  // dedupe by name
  const seen = new Set<string>();
  return merged.filter((g) => {
    const name = typeof g?.name === "string" ? g.name : "";
    if (!name || seen.has(name)) return false;
    seen.add(name);
    return true;
  });
};
