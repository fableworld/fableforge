import {
  RegistrySchema,
  CharacterSchema,
  type Registry,
  type Character,
  type Collection,
} from "@/lib/schemas";
import {
  addStoredRegistry,
  upsertCharactersForRegistry,
  removeStoredRegistry,
  getStoredRegistries,
  getStoredCharacters,
  getCollections,
} from "@/lib/store";
import { invoke } from "@tauri-apps/api/core";

export interface FetchRegistryResult {
  registry: Registry;
  skippedCount: number;
  errors: string[];
}

export const registryService = {
  /**
   * Fetch a registry from a URL, validate with partial failure handling,
   * and persist to local store.
   */
  async fetchRegistry(url: string): Promise<FetchRegistryResult> {
    const json = await invoke<any>("fetch_registry_json", { url });

    // Validate top-level metadata
    const metaResult = RegistrySchema.pick({ meta: true }).safeParse(json);
    if (!metaResult.success) {
      throw new Error(
        `Invalid registry metadata: ${metaResult.error.issues[0]?.message}`
      );
    }

    // Validate characters with partial failure
    const rawCharacters = json.characters;
    if (!Array.isArray(rawCharacters)) {
      throw new Error('Invalid registry format: "characters" must be an array');
    }

    const validCharacters: Character[] = [];
    const errors: string[] = [];

    for (const char of rawCharacters) {
      const charResult = CharacterSchema.safeParse(char);
      if (charResult.success) {
        validCharacters.push(charResult.data);
      } else {
        const name = (char as Record<string, unknown>).name ?? "unknown";
        errors.push(
          `Character "${name}" skipped: ${charResult.error.issues[0]?.message}`
        );
      }
    }

    if (validCharacters.length === 0 && rawCharacters.length > 0) {
      throw new Error("Registry contains no valid characters.");
    }

    if (errors.length > 0) {
      console.warn("Some characters were skipped:", errors);
    }

    const registry: Registry = {
      meta: metaResult.data.meta,
      characters: validCharacters,
    };

    // Persist
    await addStoredRegistry(url, registry.meta, validCharacters.length);
    await upsertCharactersForRegistry(url, validCharacters);

    return {
      registry,
      skippedCount: errors.length,
      errors,
    };
  },

  /**
   * Remove a registry and its characters from local storage.
   */
  async removeRegistry(url: string): Promise<void> {
    await removeStoredRegistry(url);
  },

  /**
   * Refresh all saved registries by re-fetching from their URLs.
   */
  async refreshAllRegistries(): Promise<void> {
    const registries = await getStoredRegistries();
    for (const reg of registries) {
      try {
        await this.fetchRegistry(reg.url);
      } catch (err) {
        console.error(`Failed to refresh ${reg.url}:`, err);
      }
    }
  },

  /**
   * Fetch and validate a registry WITHOUT persisting to local store.
   * Used for ephemeral deep link viewing.
   */
  async fetchRegistryWithoutPersist(url: string): Promise<FetchRegistryResult> {
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Failed to fetch registry: ${res.status} ${res.statusText}`);
    }

    const json = await res.json();

    const metaResult = RegistrySchema.pick({ meta: true }).safeParse(json);
    if (!metaResult.success) {
      throw new Error(
        `Invalid registry metadata: ${metaResult.error.issues[0]?.message}`
      );
    }

    const rawCharacters = json.characters;
    if (!Array.isArray(rawCharacters)) {
      throw new Error('Invalid registry format: "characters" must be an array');
    }

    const validCharacters: Character[] = [];
    const errors: string[] = [];

    for (const char of rawCharacters) {
      const charResult = CharacterSchema.safeParse(char);
      if (charResult.success) {
        validCharacters.push(charResult.data);
      } else {
        const name = (char as Record<string, unknown>).name ?? "unknown";
        errors.push(
          `Character "${name}" skipped: ${charResult.error.issues[0]?.message}`
        );
      }
    }

    if (validCharacters.length === 0 && rawCharacters.length > 0) {
      throw new Error("Registry contains no valid characters.");
    }

    if (errors.length > 0) {
      console.warn("Some characters were skipped:", errors);
    }

    return {
      registry: {
        meta: metaResult.data.meta,
        characters: validCharacters,
      },
      skippedCount: errors.length,
      errors,
    };
  },

  /**
   * Find a character by ID within a list of characters.
   */
  findCharacterById(characters: Character[], id: string): Character | undefined {
    return characters.find((c) => c.id === id);
  },

  /**
   * Load all stored data (for initial app boot).
   */
  async loadAll() {
    const registries = await getStoredRegistries();
    const storedCharacters = await getStoredCharacters();
    const collections = await getCollections();

    // Collect all characters from local collections
    const localCharacters: Character[] = collections.flatMap(
      (col: Collection) => col.characters
    );

    // Merge and deduplicate by ID. Local characters take precedence.
    const charMap = new Map<string, Character>();
    for (const char of storedCharacters) {
      charMap.set(char.id, char);
    }
    for (const char of localCharacters) {
      charMap.set(char.id, char);
    }

    return {
      registries,
      characters: Array.from(charMap.values()),
    };
  },
};
