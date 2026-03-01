import { describe, it, expect } from 'vitest';
import { createStore } from 'jotai';
import {
  pendingDeepLinkAtom,
  deepLinkProcessingAtom,
  ephemeralCharacterAtom,
  ephemeralRegistryMetaAtom,
  ephemeralRegistryUrlAtom,
} from '@/stores/deeplink';

describe('deeplink store atoms', () => {
  it('pendingDeepLinkAtom defaults to null', () => {
    const store = createStore();
    expect(store.get(pendingDeepLinkAtom)).toBeNull();
  });

  it('deepLinkProcessingAtom defaults to false', () => {
    const store = createStore();
    expect(store.get(deepLinkProcessingAtom)).toBe(false);
  });

  it('ephemeralCharacterAtom defaults to null', () => {
    const store = createStore();
    expect(store.get(ephemeralCharacterAtom)).toBeNull();
  });

  it('ephemeralRegistryMetaAtom defaults to null', () => {
    const store = createStore();
    expect(store.get(ephemeralRegistryMetaAtom)).toBeNull();
  });

  it('ephemeralRegistryUrlAtom defaults to null', () => {
    const store = createStore();
    expect(store.get(ephemeralRegistryUrlAtom)).toBeNull();
  });

  it('pendingDeepLinkAtom can store a request', () => {
    const store = createStore();
    const request = {
      type: 'character' as const,
      characterId: 'test-id',
      registryUrl: 'https://example.com/index.json',
      rawUrl: 'fableforge://character?id=test-id&registry=https%3A%2F%2Fexample.com%2Findex.json',
    };
    store.set(pendingDeepLinkAtom, request);
    expect(store.get(pendingDeepLinkAtom)).toEqual(request);
  });

  it('ephemeral atoms can be set and cleared independently', () => {
    const store = createStore();
    const character = {
      id: 'test-id',
      name: 'Test Character',
      tracks: [],
      gallery_images: [],
      models_3d: [],
    };
    const meta = { name: 'Test Registry' };

    store.set(ephemeralCharacterAtom, character);
    store.set(ephemeralRegistryMetaAtom, meta);
    store.set(ephemeralRegistryUrlAtom, 'https://example.com/index.json');

    expect(store.get(ephemeralCharacterAtom)).toEqual(character);
    expect(store.get(ephemeralRegistryMetaAtom)).toEqual(meta);
    expect(store.get(ephemeralRegistryUrlAtom)).toBe('https://example.com/index.json');

    // Clear
    store.set(ephemeralCharacterAtom, null);
    store.set(ephemeralRegistryMetaAtom, null);
    store.set(ephemeralRegistryUrlAtom, null);

    expect(store.get(ephemeralCharacterAtom)).toBeNull();
    expect(store.get(ephemeralRegistryMetaAtom)).toBeNull();
    expect(store.get(ephemeralRegistryUrlAtom)).toBeNull();
  });
});
