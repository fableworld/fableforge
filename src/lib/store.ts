import { load } from "@tauri-apps/plugin-store";
import type { Character, StoredRegistry, RegistryMeta } from "./schemas";

const STORE_PATH = "fableforge-data.json";

let storePromise: ReturnType<typeof load> | null = null;

function getStore() {
  if (!storePromise) {
    storePromise = load(STORE_PATH);
  }
  return storePromise;
}

// --- Registries ---

export async function getStoredRegistries(): Promise<StoredRegistry[]> {
  const store = await getStore();
  const registries = await store.get<StoredRegistry[]>("registries");
  return registries ?? [];
}

export async function addStoredRegistry(
  url: string,
  meta: RegistryMeta,
  characterCount: number
): Promise<void> {
  const store = await getStore();
  const registries = await getStoredRegistries();
  const now = Date.now();
  const existing = registries.findIndex((r) => r.url === url);
  const entry: StoredRegistry = {
    url,
    meta,
    characterCount,
    addedAt: existing >= 0 ? registries[existing]!.addedAt : now,
    lastUpdated: now,
  };

  if (existing >= 0) {
    registries[existing] = entry;
  } else {
    registries.push(entry);
  }

  await store.set("registries", registries);
}

export async function removeStoredRegistry(url: string): Promise<void> {
  const store = await getStore();
  const registries = await getStoredRegistries();
  await store.set(
    "registries",
    registries.filter((r) => r.url !== url)
  );
  // Also remove associated characters
  const characters = await getStoredCharacters();
  await store.set(
    "characters",
    characters.filter((c) => c.registry_url !== url)
  );
}

// --- Characters ---

export async function getStoredCharacters(): Promise<Character[]> {
  const store = await getStore();
  const characters = await store.get<Character[]>("characters");
  return characters ?? [];
}

export async function setStoredCharacters(
  characters: Character[]
): Promise<void> {
  const store = await getStore();
  await store.set("characters", characters);
}

export async function upsertCharactersForRegistry(
  registryUrl: string,
  newCharacters: Character[]
): Promise<void> {
  const all = await getStoredCharacters();
  // Remove old characters from this registry
  const others = all.filter((c) => c.registry_url !== registryUrl);
  // Add new ones (tag with registry_url)
  const tagged = newCharacters.map((c) => ({ ...c, registry_url: registryUrl }));
  await setStoredCharacters([...others, ...tagged]);
}
