import { atom } from "jotai";
import type { Collection, Character } from "@/lib/schemas";

// --- Core Data ---
export const collectionsAtom = atom<Collection[]>([]);

// --- Editor State ---
export const editingCollectionIdAtom = atom<string | null>(null);
export const editingCharacterIdAtom = atom<string | null>(null);

// --- Derived: currently editing collection ---
export const editingCollectionAtom = atom((get) => {
  const collections = get(collectionsAtom);
  const id = get(editingCollectionIdAtom);
  if (!id) return null;
  return collections.find((c) => c.id === id) ?? null;
});

// --- Derived: currently editing character ---
export const editingCharacterAtom = atom((get) => {
  const collection = get(editingCollectionAtom);
  const charId = get(editingCharacterIdAtom);
  if (!collection || !charId) return null;
  return collection.characters.find((c) => c.id === charId) ?? null;
});

// --- Helper: generate ID ---
export function generateId(): string {
  return crypto.randomUUID();
}

// --- Helper: create empty character ---
export function createEmptyCharacter(name = "New Character"): Character {
  return {
    id: generateId(),
    name,
    tracks: [],
    gallery_images: [],
    models_3d: [],
  };
}

// --- Helper: create empty collection ---
export function createEmptyCollection(name: string): Collection {
  const now = new Date().toISOString();
  return {
    id: generateId(),
    name,
    characters: [],
    created_at: now,
    updated_at: now,
  };
}
