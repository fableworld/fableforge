import { atom } from "jotai";
import type { Character, StoredRegistry } from "@/lib/schemas";

// --- Core Data Atoms ---
export const registriesAtom = atom<StoredRegistry[]>([]);
export const charactersAtom = atom<Character[]>([]);

// --- UI State Atoms ---
export const searchQueryAtom = atom<string>("");
export const sortOrderAtom = atom<"name-asc" | "name-desc" | "date-desc" | "date-asc">("name-asc");
export const isLoadingAtom = atom<boolean>(false);

// --- Derived: Filtered & Sorted Characters ---
export const filteredCharactersAtom = atom((get) => {
  const characters = get(charactersAtom);
  const query = get(searchQueryAtom).toLowerCase().trim();
  const sort = get(sortOrderAtom);

  let filtered = characters;

  // Search filter
  if (query) {
    filtered = filtered.filter(
      (c) =>
        c.name.toLowerCase().includes(query) ||
        (c.description && c.description.toLowerCase().includes(query))
    );
  }

  // Sort
  const sorted = [...filtered];
  switch (sort) {
    case "name-asc":
      sorted.sort((a, b) => a.name.localeCompare(b.name));
      break;
    case "name-desc":
      sorted.sort((a, b) => b.name.localeCompare(a.name));
      break;
    case "date-desc":
      sorted.sort(
        (a, b) =>
          new Date(b.created_at ?? 0).getTime() -
          new Date(a.created_at ?? 0).getTime()
      );
      break;
    case "date-asc":
      sorted.sort(
        (a, b) =>
          new Date(a.created_at ?? 0).getTime() -
          new Date(b.created_at ?? 0).getTime()
      );
      break;
  }

  return sorted;
});

// --- Derived: Character count per registry ---
export const registryStatsAtom = atom((get) => {
  const characters = get(charactersAtom);
  const stats = new Map<string, number>();

  for (const c of characters) {
    if (c.registry_url) {
      stats.set(c.registry_url, (stats.get(c.registry_url) ?? 0) + 1);
    }
  }

  return stats;
});
