import { describe, it, expect } from 'vitest';
import { detectIdClashes } from '@/services/clash';
import type { Character, Collection } from '@/lib/schemas';

// --- Test Helpers ---

function makeCharacter(overrides: Partial<Character> & { id: string; name: string }): Character {
  return {
    tracks: [],
    gallery_images: [],
    models_3d: [],
    ...overrides,
  };
}

function makeCollection(name: string, characters: Character[]): Collection {
  return {
    id: `col-${name}`,
    name,
    characters,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

// --- Tests ---

describe('detectIdClashes', () => {
  it('returns empty array when no clashes exist', () => {
    const newChars = [makeCharacter({ id: 'a', name: 'Alpha' })];
    const stored = [makeCharacter({ id: 'b', name: 'Beta' })];
    const collections: Collection[] = [];

    expect(detectIdClashes(newChars, stored, collections)).toEqual([]);
  });

  it('detects clash with stored registry character', () => {
    const newChars = [makeCharacter({ id: 'clash-id', name: 'New One' })];
    const stored = [
      makeCharacter({ id: 'clash-id', name: 'Old One', registry_url: 'https://old.com/index.json' }),
    ];
    const collections: Collection[] = [];

    const clashes = detectIdClashes(newChars, stored, collections);
    expect(clashes).toHaveLength(1);
    expect(clashes[0]).toEqual({
      id: 'clash-id',
      newName: 'New One',
      existingName: 'Old One',
      existingSource: 'registry',
      existingSourceLabel: 'https://old.com/index.json',
    });
  });

  it('detects clash with local collection character', () => {
    const newChars = [makeCharacter({ id: 'clash-id', name: 'Registry Char' })];
    const stored: Character[] = [];
    const collections = [
      makeCollection('My Collection', [
        makeCharacter({ id: 'clash-id', name: 'Local Char' }),
      ]),
    ];

    const clashes = detectIdClashes(newChars, stored, collections);
    expect(clashes).toHaveLength(1);
    expect(clashes[0]).toEqual({
      id: 'clash-id',
      newName: 'Registry Char',
      existingName: 'Local Char',
      existingSource: 'collection',
      existingSourceLabel: 'My Collection',
    });
  });

  it('does NOT report clash for same ID + same name (genuine duplicate)', () => {
    const newChars = [makeCharacter({ id: 'dup-id', name: 'Same Name' })];
    const stored = [makeCharacter({ id: 'dup-id', name: 'Same Name' })];
    const collections: Collection[] = [];

    expect(detectIdClashes(newChars, stored, collections)).toEqual([]);
  });

  it('collection clash takes precedence over registry clash', () => {
    const newChars = [makeCharacter({ id: 'clash-id', name: 'New Char' })];
    const stored = [
      makeCharacter({ id: 'clash-id', name: 'Registry Char', registry_url: 'https://r.com' }),
    ];
    const collections = [
      makeCollection('My Stuff', [
        makeCharacter({ id: 'clash-id', name: 'Collection Char' }),
      ]),
    ];

    const clashes = detectIdClashes(newChars, stored, collections);
    // Should only report the collection clash, not both
    expect(clashes).toHaveLength(1);
    expect(clashes[0]!.existingSource).toBe('collection');
  });

  it('detects multiple clashes', () => {
    const newChars = [
      makeCharacter({ id: 'a', name: 'Alpha New' }),
      makeCharacter({ id: 'b', name: 'Beta New' }),
      makeCharacter({ id: 'c', name: 'Gamma (no clash)' }),
    ];
    const stored = [
      makeCharacter({ id: 'a', name: 'Alpha Old', registry_url: 'https://r.com' }),
      makeCharacter({ id: 'b', name: 'Beta Old', registry_url: 'https://r2.com' }),
    ];
    const collections: Collection[] = [];

    const clashes = detectIdClashes(newChars, stored, collections);
    expect(clashes).toHaveLength(2);
    expect(clashes.map((c) => c.id).sort()).toEqual(['a', 'b']);
  });

  it('handles empty inputs gracefully', () => {
    expect(detectIdClashes([], [], [])).toEqual([]);
    expect(
      detectIdClashes(
        [makeCharacter({ id: 'a', name: 'A' })],
        [],
        []
      )
    ).toEqual([]);
  });
});
