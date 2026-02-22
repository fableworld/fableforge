import { describe, it, expect } from 'vitest';
import { createStore } from 'jotai';
import {
    charactersAtom,
    searchQueryAtom,
    sortOrderAtom,
    filteredCharactersAtom
} from '../registries';
import type { Character } from '@/lib/schemas';

const mockCharacters = [
    {
        id: '1',
        name: 'Zebra',
        description: 'A striped animal',
        created_at: '2023-01-01T00:00:00Z',
    },
    {
        id: '2',
        name: 'Apple',
        description: 'A red fruit',
        created_at: '2023-01-05T00:00:00Z',
    },
    {
        id: '3',
        name: 'Banana',
        description: 'A yellow fruit',
        created_at: '2023-01-03T00:00:00Z',
    }
] as unknown as Character[];

describe('Registries Store', () => {
    it('filters characters based on search query', () => {
        const store = createStore();
        store.set(charactersAtom, mockCharacters);

        store.set(searchQueryAtom, 'fruit');
        let filtered = store.get(filteredCharactersAtom);
        expect(filtered).toHaveLength(2);
        expect(filtered.map(c => c.name)).toContain('Apple');
        expect(filtered.map(c => c.name)).toContain('Banana');

        store.set(searchQueryAtom, 'Zebra');
        filtered = store.get(filteredCharactersAtom);
        expect(filtered).toHaveLength(1);
        expect(filtered[0]?.name).toBe('Zebra');
    });

    it('sorts characters by name ascending and descending', () => {
        const store = createStore();
        store.set(charactersAtom, mockCharacters);

        store.set(sortOrderAtom, 'name-asc');
        let sorted = store.get(filteredCharactersAtom);
        expect(sorted.map(c => c.name)).toEqual(['Apple', 'Banana', 'Zebra']);

        store.set(sortOrderAtom, 'name-desc');
        sorted = store.get(filteredCharactersAtom);
        expect(sorted.map(c => c.name)).toEqual(['Zebra', 'Banana', 'Apple']);
    });

    it('sorts characters by date ascending and descending', () => {
        const store = createStore();
        store.set(charactersAtom, mockCharacters);

        store.set(sortOrderAtom, 'date-asc');
        let sorted = store.get(filteredCharactersAtom);
        expect(sorted.map(c => c.name)).toEqual(['Zebra', 'Banana', 'Apple']); // 1st, 3rd, 5th

        store.set(sortOrderAtom, 'date-desc');
        sorted = store.get(filteredCharactersAtom);
        expect(sorted.map(c => c.name)).toEqual(['Apple', 'Banana', 'Zebra']); // 5th, 3rd, 1st
    });
});
