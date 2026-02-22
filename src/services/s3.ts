import { invoke } from "@tauri-apps/api/core";
import type {
    S3Config,
    S3ConnectionResult,
    SyncMetadata,
    SyncResult,
    CharacterSyncInput,
} from "@/stores/s3";

export const s3Service = {
    /**
     * Save an S3 configuration (creates or updates).
     * Also stores credentials in the OS keyring.
     */
    async saveConfig(
        config: S3Config,
        accessKey: string,
        secretKey: string
    ): Promise<void> {
        // Save the config (without credentials)
        await invoke("s3_save_config", { config });

        // Store credentials in OS keyring
        await invoke("s3_store_credentials", {
            configId: config.id,
            accessKey,
            secretKey,
        });
    },

    /**
     * Get all saved S3 configurations.
     */
    async getConfigs(): Promise<S3Config[]> {
        return invoke<S3Config[]>("s3_get_configs");
    },

    /**
     * Delete an S3 configuration and its keyring credentials.
     */
    async deleteConfig(configId: string): Promise<void> {
        await invoke("s3_delete_config", { configId });
    },

    /**
     * Test an S3 connection by config ID.
     * The config and credentials must already be saved.
     */
    async testConnection(configId: string): Promise<S3ConnectionResult> {
        return invoke<S3ConnectionResult>("s3_test_connection", { configId });
    },

    /**
     * Get the public URL of the index.json for a config.
     * Returns null if the bucket is not marked as public.
     */
    async getPublicUrl(configId: string): Promise<string | null> {
        return invoke<string | null>("s3_get_public_url", { configId });
    },

    // --- Sync Operations ---

    /**
     * Upload a character and its assets to S3.
     */
    async syncUpload(
        configId: string,
        character: CharacterSyncInput,
        collectionName: string,
        collectionDescription?: string
    ): Promise<SyncResult> {
        return invoke<SyncResult>("s3_sync_upload", {
            configId,
            character,
            collectionName,
            collectionDescription,
        });
    },

    /**
     * Download a character and its assets from S3.
     */
    async syncDownload(
        configId: string,
        characterId: string
    ): Promise<SyncResult> {
        return invoke<SyncResult>("s3_sync_download", {
            configId,
            characterId,
        });
    },

    /**
     * Get sync status for all characters tied to a config.
     */
    async getSyncStatus(configId: string): Promise<SyncMetadata[]> {
        return invoke<SyncMetadata[]>("s3_get_sync_status", { configId });
    },

    /**
     * Force resolve a conflict.
     * @param resolution - "local" (upload our version) or "remote" (download theirs)
     */
    async resolveConflict(
        configId: string,
        characterId: string,
        resolution: "local" | "remote",
        character?: CharacterSyncInput,
        collectionName?: string,
        collectionDescription?: string
    ): Promise<SyncResult> {
        return invoke<SyncResult>("s3_resolve_conflict", {
            configId,
            characterId,
            resolution,
            character,
            collectionName,
            collectionDescription,
        });
    },
};
