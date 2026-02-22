import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useSetAtom } from "jotai";
import {
  Plus,
  ArrowLeft,
  Users,
  Trash2,
  Upload,
  Download,
  CheckCircle2,
  ArrowUpCircle,
  ArrowDownCircle,
  AlertTriangle,
  Loader2,
  Cloud,
  CloudOff,
} from "lucide-react";
import { collectionsAtom } from "@/stores/collections";
import { createEmptyCharacter } from "@/stores/collections";
import { useToast } from "@/components/ToastProvider";
import {
  getCollectionById,
  saveCollection,
  getCollections,
} from "@/lib/store";
import { CharacterForm } from "@/components/CharacterForm";
import type { Character, Collection } from "@/lib/schemas";
import { s3Service } from "@/services/s3";
import type { S3Config, SyncMetadata, CharacterSyncInput } from "@/stores/s3";

export function EditorPage() {
  const { collectionId, characterId } = useParams<{
    collectionId?: string;
    characterId?: string;
  }>();
  const navigate = useNavigate();
  const setCollections = useSetAtom(collectionsAtom);
  const { show: toast } = useToast();

  const [collection, setCollection] = useState<Collection | null>(null);
  const [selectedCharId, setSelectedCharId] = useState<string | null>(
    characterId ?? null
  );

  // S3 sync state
  const [s3Config, setS3Config] = useState<S3Config | null>(null);
  const [syncStatuses, setSyncStatuses] = useState<Map<string, SyncMetadata>>(new Map());
  const [syncingCharId, setSyncingCharId] = useState<string | null>(null);
  const [isSyncingAll, setIsSyncingAll] = useState(false);

  const loadCollection = useCallback(async () => {
    if (!collectionId) return;
    const c = await getCollectionById(collectionId);
    if (c) {
      setCollection(c);
      // Select first character if none selected
      if (!selectedCharId && c.characters.length > 0) {
        setSelectedCharId(c.characters[0]!.id);
      }
    }
  }, [collectionId, selectedCharId]);

  // Load S3 config for this collection
  const loadS3Config = useCallback(async () => {
    if (!collectionId) return;
    try {
      const configs = await s3Service.getConfigs();
      const cfg = configs.find((c) => c.collection_id === collectionId);
      setS3Config(cfg ?? null);

      if (cfg) {
        const statuses = await s3Service.getSyncStatus(cfg.id);
        const map = new Map<string, SyncMetadata>();
        statuses.forEach((s) => map.set(s.character_id, s));
        setSyncStatuses(map);
      }
    } catch (e) {
      console.error("Failed to load S3 config", e);
    }
  }, [collectionId]);

  useEffect(() => {
    loadCollection();
    loadS3Config();
  }, [loadCollection, loadS3Config]);

  // Auto-sync: refresh sync statuses periodically (every 60 seconds)
  useEffect(() => {
    if (!s3Config) return;
    const interval = setInterval(() => {
      loadS3Config();
    }, 60_000);
    return () => clearInterval(interval);
  }, [s3Config, loadS3Config]);

  const selectedChar = collection?.characters.find(
    (c) => c.id === selectedCharId
  );

  const handleAddCharacter = async () => {
    if (!collection) return;
    const newChar = createEmptyCharacter();
    const updated: Collection = {
      ...collection,
      characters: [...collection.characters, newChar],
      updated_at: new Date().toISOString(),
    };
    await saveCollection(updated);
    setCollection(updated);
    setSelectedCharId(newChar.id);
    // Sync global state
    const all = await getCollections();
    setCollections(all);
    toast("Character added", "success");
  };

  const handleDeleteCharacter = async (charId: string) => {
    if (!collection) return;
    const updated: Collection = {
      ...collection,
      characters: collection.characters.filter((c) => c.id !== charId),
      updated_at: new Date().toISOString(),
    };
    await saveCollection(updated);
    setCollection(updated);
    if (selectedCharId === charId) {
      setSelectedCharId(updated.characters[0]?.id ?? null);
    }
    const all = await getCollections();
    setCollections(all);
    toast("Character deleted", "success");
  };

  const handleSaveCharacter = async (character: Character) => {
    if (!collection) return;
    const updated: Collection = {
      ...collection,
      characters: collection.characters.map((c) =>
        c.id === character.id ? character : c
      ),
      updated_at: new Date().toISOString(),
    };
    await saveCollection(updated);
    setCollection(updated);
    const all = await getCollections();
    setCollections(all);
    toast("Character saved", "success");
  };

  // --- Sync Handlers ---

  function buildSyncInput(char: Character): CharacterSyncInput {
    return {
      id: char.id,
      name: char.name,
      description: char.description,
      created_at: char.created_at,
      preview_image_path: char.preview_image,
      nfc_payload: char.nfc_payload,
      device_address: char.device_address,
      track_paths: char.tracks.map((t) => t.local_path ?? t.url ?? "").filter(Boolean),
      track_titles: char.tracks.map((t) => t.title ?? null),
    };
  }

  const handleSyncUpload = async (char: Character) => {
    if (!s3Config || !collection) return;
    setSyncingCharId(char.id);
    try {
      const input = buildSyncInput(char);
      const result = await s3Service.syncUpload(
        s3Config.id,
        input,
        collection.name,
        collection.description
      );
      if (result.success) {
        toast(`Uploaded "${char.name}" to S3`, "success");
      } else {
        toast(`Upload failed: ${result.message}`, "error");
      }
      await loadS3Config(); // Refresh statuses
    } catch (err) {
      toast(`Upload error: ${err}`, "error");
    } finally {
      setSyncingCharId(null);
    }
  };

  const handleSyncDownload = async (charId: string) => {
    if (!s3Config) return;
    setSyncingCharId(charId);
    try {
      const result = await s3Service.syncDownload(s3Config.id, charId);
      if (result.success) {
        toast("Downloaded from S3", "success");
        await loadCollection(); // Refresh local data
      } else {
        toast(`Download failed: ${result.message}`, "error");
      }
      await loadS3Config();
    } catch (err) {
      toast(`Download error: ${err}`, "error");
    } finally {
      setSyncingCharId(null);
    }
  };

  const handleSyncAll = async () => {
    if (!s3Config || !collection) return;
    setIsSyncingAll(true);
    try {
      const inputs = collection.characters.map(buildSyncInput);
      const results = await s3Service.syncAll(
        s3Config.id,
        inputs,
        collection.name,
        collection.description
      );
      const succeeded = results.filter((r) => r.success).length;
      const failed = results.length - succeeded;
      if (failed === 0) {
        toast(`Synced all ${succeeded} characters to S3`, "success");
      } else {
        toast(`${succeeded} synced, ${failed} failed`, "error");
      }
      await loadS3Config();
    } catch (err) {
      toast(`Sync all error: ${err}`, "error");
    } finally {
      setIsSyncingAll(false);
    }
  };

  const handleResolveConflict = async (charId: string, resolution: "local" | "remote") => {
    if (!s3Config || !collection) return;
    setSyncingCharId(charId);
    try {
      const char = collection.characters.find((c) => c.id === charId);
      const input = char ? buildSyncInput(char) : undefined;
      const result = await s3Service.resolveConflict(
        s3Config.id,
        charId,
        resolution,
        input,
        collection.name,
        collection.description
      );
      if (result.success) {
        toast(`Conflict resolved (${resolution})`, "success");
        if (resolution === "remote") await loadCollection();
      } else {
        toast(`Resolution failed: ${result.message}`, "error");
      }
      await loadS3Config();
    } catch (err) {
      toast(`Error: ${err}`, "error");
    } finally {
      setSyncingCharId(null);
    }
  };

  // Helper: sync status badge component
  function SyncBadge({ charId }: { charId: string }) {
    const meta = syncStatuses.get(charId);
    if (!s3Config || !meta) {
      return s3Config ? <CloudOff size={12} style={{ color: "var(--color-text-tertiary)", opacity: 0.5 }} /> : null;
    }

    const isSyncing = syncingCharId === charId;
    if (isSyncing) {
      return <Loader2 size={12} className="spin" style={{ color: "var(--color-primary)" }} />;
    }

    switch (meta.sync_status) {
      case "synced":
        return <CheckCircle2 size={12} style={{ color: "var(--color-success, #22c55e)" }} />;
      case "pending_upload":
        return <ArrowUpCircle size={12} style={{ color: "var(--color-warning, #f59e0b)" }} />;
      case "pending_download":
        return <ArrowDownCircle size={12} style={{ color: "var(--color-info, #3b82f6)" }} />;
      case "conflict":
        return <AlertTriangle size={12} style={{ color: "var(--color-error, #ef4444)" }} />;
      default:
        return <CloudOff size={12} style={{ color: "var(--color-text-tertiary)", opacity: 0.5 }} />;
    }
  }

  const selectedMeta = selectedCharId ? syncStatuses.get(selectedCharId) : null;
  const hasConflict = selectedMeta?.sync_status === "conflict";

  if (!collectionId) {
    return (
      <>
        <header className="main-content__header">
          <h1 className="main-content__title">Character Editor</h1>
        </header>
        <div className="main-content__body">
          <div className="empty-state">
            <div className="empty-state__icon">
              <Users size={28} />
            </div>
            <h2 className="empty-state__title">Select a collection</h2>
            <p className="empty-state__description">
              Open a collection from the Collections page to start editing
              characters.
            </p>
            <button
              className="btn btn--primary"
              onClick={() => navigate("/collections")}
            >
              Go to Collections
            </button>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <header className="main-content__header">
        <button className="btn btn--ghost" onClick={() => navigate("/collections")}>
          <ArrowLeft size={16} />
          Collections
        </button>
        <h1 className="main-content__title" style={{ flex: 1 }}>
          {collection?.name ?? "Loading..."}
        </h1>
        {s3Config && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "var(--space-2)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "var(--space-1)",
                fontSize: "var(--text-xs)",
                color: "var(--color-text-tertiary)",
              }}
            >
              <Cloud size={14} />
              <span>S3 Sync</span>
            </div>
            <button
              className="btn btn--ghost btn--sm"
              onClick={handleSyncAll}
              disabled={isSyncingAll || syncingCharId !== null}
              title="Upload all characters to S3"
            >
              {isSyncingAll ? (
                <Loader2 size={14} className="spin" />
              ) : (
                <Upload size={14} />
              )}
              Sync All
            </button>
          </div>
        )}
      </header>

      <div className="main-content__body">
        <div className="editor-layout">
          {/* Character sidebar */}
          <aside className="editor-sidebar">
            <div className="editor-sidebar__header">
              <span className="editor-sidebar__title">Characters</span>
              <button
                className="btn btn--ghost btn--icon btn--sm"
                onClick={handleAddCharacter}
                title="Add character"
              >
                <Plus size={14} />
              </button>
            </div>
            <div className="editor-sidebar__list">
              {collection?.characters.map((c) => (
                <div
                  key={c.id}
                  className={`editor-sidebar__item ${selectedCharId === c.id ? "editor-sidebar__item--active" : ""}`}
                  onClick={() => setSelectedCharId(c.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") setSelectedCharId(c.id);
                  }}
                >
                  <span className="editor-sidebar__item-name" style={{ display: "flex", alignItems: "center", gap: "var(--space-1)", flex: 1 }}>
                    {c.name}
                    <SyncBadge charId={c.id} />
                  </span>
                  <button
                    className="btn btn--ghost btn--icon btn--xs"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteCharacter(c.id);
                    }}
                    title="Delete character"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
              {collection?.characters.length === 0 && (
                <div className="editor-sidebar__empty">
                  No characters yet
                </div>
              )}
            </div>
          </aside>

          {/* Character form */}
          <div className="editor-main">
            {/* Conflict banner */}
            {hasConflict && selectedChar && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "var(--space-3)",
                  padding: "var(--space-3) var(--space-4)",
                  marginBottom: "var(--space-4)",
                  borderRadius: "var(--radius-md)",
                  backgroundColor: "var(--color-error-bg, rgba(239, 68, 68, 0.1))",
                  border: "1px solid var(--color-error, #ef4444)",
                  fontSize: "var(--text-sm)",
                }}
              >
                <AlertTriangle size={18} style={{ color: "var(--color-error, #ef4444)", flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <strong>Sync Conflict</strong> — This character was modified both locally and remotely.
                </div>
                <button
                  className="btn btn--secondary btn--sm"
                  onClick={() => handleResolveConflict(selectedChar.id, "local")}
                  disabled={syncingCharId === selectedChar.id}
                  style={{ whiteSpace: "nowrap" }}
                >
                  {syncingCharId === selectedChar.id ? <Loader2 size={12} className="spin" /> : <Upload size={12} />}
                  Keep Local
                </button>
                <button
                  className="btn btn--secondary btn--sm"
                  onClick={() => handleResolveConflict(selectedChar.id, "remote")}
                  disabled={syncingCharId === selectedChar.id}
                  style={{ whiteSpace: "nowrap" }}
                >
                  {syncingCharId === selectedChar.id ? <Loader2 size={12} className="spin" /> : <Download size={12} />}
                  Use Remote
                </button>
              </div>
            )}

            {/* Sync action buttons (when not in conflict) */}
            {s3Config && selectedChar && !hasConflict && (
              <div
                style={{
                  display: "flex",
                  gap: "var(--space-2)",
                  marginBottom: "var(--space-3)",
                  justifyContent: "flex-end",
                }}
              >
                <button
                  className="btn btn--ghost btn--sm"
                  onClick={() => handleSyncUpload(selectedChar)}
                  disabled={syncingCharId === selectedChar.id}
                  title="Upload to S3"
                >
                  {syncingCharId === selectedChar.id ? (
                    <Loader2 size={14} className="spin" />
                  ) : (
                    <Upload size={14} />
                  )}
                  Upload
                </button>
                <button
                  className="btn btn--ghost btn--sm"
                  onClick={() => handleSyncDownload(selectedChar.id)}
                  disabled={syncingCharId === selectedChar.id}
                  title="Download from S3"
                >
                  {syncingCharId === selectedChar.id ? (
                    <Loader2 size={14} className="spin" />
                  ) : (
                    <Download size={14} />
                  )}
                  Download
                </button>
              </div>
            )}

            {selectedChar ? (
              <CharacterForm
                key={selectedChar.id}
                character={selectedChar}
                collectionId={collectionId}
                onSave={handleSaveCharacter}
                onCancel={() => setSelectedCharId(null)}
              />
            ) : (
              <div className="empty-state">
                <h2 className="empty-state__title">
                  {collection?.characters.length === 0
                    ? "Add a character"
                    : "Select a character"}
                </h2>
                <p className="empty-state__description">
                  {collection?.characters.length === 0
                    ? 'Click the "+" button to create your first character.'
                    : "Click a character name in the sidebar to start editing."}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

