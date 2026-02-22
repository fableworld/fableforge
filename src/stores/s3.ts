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
    collection_id: string;
}

export interface S3ConnectionResult {
    success: boolean;
    message: string;
    object_count?: number;
}

// --- Atoms ---
export const s3ConfigsAtom = atom<S3Config[]>([]);
export const s3TestingAtom = atom<string | null>(null); // config ID currently being tested
