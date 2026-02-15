import { z } from "zod";

// --- 3D Model ---
export const Model3DSchema = z.object({
  provider: z
    .enum(["makerworld", "printables", "thingiverse", "direct", "other"])
    .default("other"),
  url: z.string().url(),
});

// --- Track (FableForge extension) ---
export const TrackSchema = z.object({
  url: z.string().optional(),
  title: z.string().optional(),
  duration: z.number().optional(),
  local_path: z.string().optional(),
});

// --- Character ---
export const CharacterSchema = z.object({
  id: z.string(),
  name: z.string().min(1, "Name is required"),
  created_at: z.string().datetime().optional(),
  preview_image: z.string().url().optional(),
  description: z.string().optional(),
  gallery_images: z.array(z.string().url()).optional().default([]),
  audio_sample_url: z.string().url().optional(),
  audio_zip_url: z.string().url().optional(),
  models_3d: z.array(Model3DSchema).optional().default([]),
  nfc_payload: z.string().optional(),
  registry_url: z.string().url().optional(),
  // FableForge extensions
  tracks: z.array(TrackSchema).optional().default([]),
  device_address: z.number().int().min(0).max(499).optional(),
});

// --- Registry ---
export const RegistryMetaSchema = z.object({
  name: z.string(),
  version: z.string().optional(),
  maintainer: z.string().optional(),
});

export const RegistrySchema = z.object({
  meta: RegistryMetaSchema,
  characters: z.array(CharacterSchema),
});

// --- Inferred Types ---
export type Model3D = z.infer<typeof Model3DSchema>;
export type Track = z.infer<typeof TrackSchema>;
export type Character = z.infer<typeof CharacterSchema>;
export type RegistryMeta = z.infer<typeof RegistryMetaSchema>;
export type Registry = z.infer<typeof RegistrySchema>;

// --- Stored Registry (with metadata) ---
export interface StoredRegistry {
  url: string;
  meta: RegistryMeta;
  characterCount: number;
  addedAt: number;
  lastUpdated: number;
}

// --- Collection (local) ---
export const CollectionSchema = z.object({
  id: z.string(),
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  cover_image: z.string().optional(),
  characters: z.array(CharacterSchema),
  created_at: z.string(),
  updated_at: z.string(),
});

export type Collection = z.infer<typeof CollectionSchema>;

