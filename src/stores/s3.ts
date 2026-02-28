import { atom } from "jotai";

// --- S3 Config Types ---
export interface S3Config {
    id: string;
    name: string;
    endpoint: string;
    region: string;
    bucket: string;
    prefix?: string;
    is_public: boolean;
    base_url?: string;
    public_url?: string;
    collection_id: string;
}

export interface S3ConnectionResult {
    success: boolean;
    message: string;
    object_count?: number;
}

export interface SyncMetadata {
    character_id: string;
    sync_status: string;
    local_hash?: string;
    remote_etag?: string;
    last_synced_at?: string;
    sync_enabled: boolean;
}

export interface SyncResult {
    character_id: string;
    success: boolean;
    status: string;
    message?: string;
}

export interface CharacterSyncInput {
    id: string;
    name: string;
    description?: string;
    created_at?: string;
    preview_image_path?: string;
    nfc_payload?: string;
    device_address?: number;
    track_paths: string[];
    track_titles: (string | null)[];
}

// --- Atoms ---
export const s3ConfigsAtom = atom<S3Config[]>([]);
export const s3TestingAtom = atom<string | null>(null); // config ID currently being tested
export const syncStatusAtom = atom<Map<string, SyncMetadata>>(new Map());
export const syncingAtom = atom<string | null>(null); // character ID currently syncing
