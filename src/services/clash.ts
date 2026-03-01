/**
 * ID clash detection between characters from different sources.
 *
 * Rules:
 * - Local collections always take priority over any registry
 * - More recently imported registries take priority over older ones
 * - A "clash" is when two characters share the same ID but are from different sources
 * - Same ID + same name from different sources = genuine duplicate (not a clash)
 */

import type { Character, Collection } from '@/lib/schemas';

export interface ClashInfo {
  /** The shared character ID */
  id: string;
  /** Name of the character in the new registry */
  newName: string;
  /** Name of the character that already exists */
  existingName: string;
  /** Source of the existing character */
  existingSource: 'registry' | 'collection';
  /** Source label (registry URL or collection name) */
  existingSourceLabel: string;
}

/**
 * Detect ID clashes between characters from a new registry and existing data.
 *
 * A clash occurs when:
 * - A character in `newCharacters` has the same ID as an existing character
 * - AND their names differ (same ID + same name = genuine duplicate, not a clash)
 *
 * @param newCharacters - Characters from the new registry
 * @param storedCharacters - Characters already in persisted registries
 * @param collections - Local collections
 * @returns List of clashes found
 */
export function detectIdClashes(
  newCharacters: Character[],
  storedCharacters: Character[],
  collections: Collection[],
): ClashInfo[] {
  const clashes: ClashInfo[] = [];

  // Build lookup maps for existing characters
  const storedMap = new Map<string, Character>();
  for (const c of storedCharacters) {
    storedMap.set(c.id, c);
  }

  const collectionMap = new Map<string, { character: Character; collectionName: string }>();
  for (const col of collections) {
    for (const c of col.characters) {
      collectionMap.set(c.id, { character: c, collectionName: col.name });
    }
  }

  for (const newChar of newCharacters) {
    // Check local collections first (higher priority)
    const colMatch = collectionMap.get(newChar.id);
    if (colMatch && colMatch.character.name !== newChar.name) {
      clashes.push({
        id: newChar.id,
        newName: newChar.name,
        existingName: colMatch.character.name,
        existingSource: 'collection',
        existingSourceLabel: colMatch.collectionName,
      });
      continue; // Don't double-report from registry
    }

    // Check stored registry characters
    const storedMatch = storedMap.get(newChar.id);
    if (storedMatch && storedMatch.name !== newChar.name) {
      clashes.push({
        id: newChar.id,
        newName: newChar.name,
        existingName: storedMatch.name,
        existingSource: 'registry',
        existingSourceLabel: storedMatch.registry_url ?? 'sconosciuto',
      });
    }
  }

  return clashes;
}
