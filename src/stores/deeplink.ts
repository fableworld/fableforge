import { atom } from 'jotai';
import type { DeepLinkRequest } from '@/services/deeplink';
import type { Character, RegistryMeta } from '@/lib/schemas';

// --- Deep Link Queue ---

/** The pending deep link request awaiting processing. */
export const pendingDeepLinkAtom = atom<DeepLinkRequest | null>(null);

/** Whether a deep link is currently being resolved (fetch/validate/navigate). */
export const deepLinkProcessingAtom = atom<boolean>(false);

// --- Ephemeral State ---

/** A character loaded via deep link without importing the registry. Not persisted. */
export const ephemeralCharacterAtom = atom<Character | null>(null);

/** Registry metadata for the ephemeral character (for display in banner). */
export const ephemeralRegistryMetaAtom = atom<RegistryMeta | null>(null);

/** The registry URL for the ephemeral character. */
export const ephemeralRegistryUrlAtom = atom<string | null>(null);
