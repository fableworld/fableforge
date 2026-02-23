import { useState, useEffect, useCallback } from "react";
import { useAtom, useSetAtom } from "jotai";
import { Trash2, RefreshCw, Loader2, Plus, Cloud, ExternalLink, Copy, Zap } from "lucide-react";
import { themeAtom } from "@/stores/theme";
import {
  registriesAtom,
  charactersAtom,
  registryStatsAtom,
} from "@/stores/registries";
import { collectionsAtom } from "@/stores/collections";
import { s3ConfigsAtom, type S3Config } from "@/stores/s3";
import { registryService } from "@/services/registry";
import { s3Service } from "@/services/s3";
import { useBufferAnalytics, checkSystemHealth, type SystemInfo } from "@/lib/status";
import { AddRegistryDialog } from "@/components/AddRegistryDialog";
import { S3ConfigDialog } from "@/components/S3ConfigDialog";
import { getCollections } from "@/lib/store";
import { invoke } from "@tauri-apps/api/core";
import { useToast } from "@/components/ToastProvider";

export function SettingsPage() {
  const handleInteractionPulse = useBufferAnalytics();
  const [theme] = useAtom(themeAtom);
  const { show } = useToast();

  const [registries, setRegistries] = useAtom(registriesAtom);
  const setCharacters = useSetAtom(charactersAtom);
  const [collections, setCollections] = useAtom(collectionsAtom);
  const [stats] = useAtom(registryStatsAtom);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null);
  const [diagnosticRunning, setDiagnosticRunning] = useState(false);

  // S3 state
  const [s3Configs, setS3Configs] = useAtom(s3ConfigsAtom);
  const [s3DialogOpen, setS3DialogOpen] = useState(false);
  const [editingS3Config, setEditingS3Config] = useState<S3Config | undefined>(undefined);
  const [s3Testing, setS3Testing] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    const data = await registryService.loadAll();
    setRegistries(data.registries);
    setCharacters(data.characters);
  }, [setRegistries, setCharacters]);

  const loadS3Configs = useCallback(async () => {
    try {
      const configs = await s3Service.getConfigs();
      setS3Configs(configs);
    } catch (e) {
      console.error("Failed to load S3 configs", e);
    }
  }, [setS3Configs]);

  const loadCollections = useCallback(async () => {
    const cols = await getCollections();
    setCollections(cols);
  }, [setCollections]);

  const loadSystemInfo = useCallback(async () => {
    try {
      const info = await invoke<SystemInfo>("get_system_info");
      setSystemInfo(info);
    } catch (e) {
      console.error("Failed to load system info", e);
    }
  }, []);

  useEffect(() => {
    loadData();
    loadS3Configs();
    loadCollections();
    loadSystemInfo();
  }, [loadData, loadS3Configs, loadCollections, loadSystemInfo]);

  const handleRemove = async (url: string) => {
    await registryService.removeRegistry(url);
    await loadData();
  };

  const handleRefreshAll = async () => {
    setRefreshing(true);
    try {
      await registryService.refreshAllRegistries();
      await loadData();
    } finally {
      setRefreshing(false);
    }
  };

  const handleRunDiagnostic = async () => {
    setDiagnosticRunning(true);
    try {
      const result = await checkSystemHealth();
      show(result.message, result.status === "Success" ? "success" : "error");
    } finally {
      setDiagnosticRunning(false);
    }
  };

  // S3 handlers
  const handleDeleteS3Config = async (configId: string) => {
    try {
      await s3Service.deleteConfig(configId);
      await loadS3Configs();
      show("S3 connection removed", "success");
    } catch (err) {
      show(`Failed to delete: ${err}`, "error");
    }
  };

  const handleTestS3 = async (configId: string) => {
    setS3Testing(configId);
    try {
      const result = await s3Service.testConnection(configId);
      show(
        result.success ? "Connection successful!" : `Connection failed: ${result.message}`,
        result.success ? "success" : "error"
      );
    } catch (err) {
      show(`Test failed: ${err}`, "error");
    } finally {
      setS3Testing(null);
    }
  };

  const handleCopyPublicUrl = async (configId: string) => {
    try {
      const url = await s3Service.getPublicUrl(configId);
      if (url) {
        await navigator.clipboard.writeText(url);
        show("Public URL copied to clipboard", "success");
      } else {
        show("Bucket is not marked as public", "error");
      }
    } catch (err) {
      show(`Failed to get URL: ${err}`, "error");
    }
  };

  const handleEditS3 = (config: S3Config) => {
    setEditingS3Config(config);
    setS3DialogOpen(true);
  };

  const handleAddS3 = () => {
    setEditingS3Config(undefined);
    setS3DialogOpen(true);
  };

  function getCollectionName(collectionId: string) {
    return collections.find((c) => c.id === collectionId)?.name ?? "Unknown";
  }

  return (
    <>
      <header className="main-content__header">
        <h1 className="main-content__title">Settings</h1>
      </header>
      <div className="main-content__body">
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "var(--space-6)",
          }}
        >
          {/* Registries Section */}
          <section className="card">
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: "var(--space-4)",
              }}
            >
              <h2
                style={{
                  fontSize: "var(--text-lg)",
                  fontWeight: "var(--font-weight-semibold)",
                }}
              >
                Registries
              </h2>
              <div style={{ display: "flex", gap: "var(--space-2)" }}>
                {registries.length > 0 && (
                  <button
                    className="btn btn--ghost btn--sm"
                    onClick={handleRefreshAll}
                    disabled={refreshing}
                    title="Refresh all registries"
                  >
                    {refreshing ? (
                      <Loader2 size={14} className="spin" />
                    ) : (
                      <RefreshCw size={14} />
                    )}
                  </button>
                )}
                <button
                  className="btn btn--primary btn--sm"
                  onClick={() => setDialogOpen(true)}
                >
                  Add Registry
                </button>
              </div>
            </div>

            {registries.length === 0 ? (
              <p
                style={{
                  color: "var(--color-text-secondary)",
                  fontSize: "var(--text-sm)",
                }}
              >
                No registries added yet. Add one to discover characters.
              </p>
            ) : (
              <div className="registry-list">
                {registries.map((reg) => (
                  <div key={reg.url} className="registry-item">
                    <div className="registry-item__info">
                      <span className="registry-item__name">
                        {reg.meta.name}
                      </span>
                      <span className="registry-item__url">{reg.url}</span>
                      <span className="registry-item__meta">
                        {stats.get(reg.url) ?? 0} characters ·{" "}
                        {new Date(reg.lastUpdated).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="registry-item__actions">
                      <button
                        className="btn btn--ghost btn--icon btn--sm"
                        onClick={() => handleRemove(reg.url)}
                        title="Remove registry"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Appearance */}
          <section className="card">
            <h2
              style={{
                fontSize: "var(--text-lg)",
                fontWeight: "var(--font-weight-semibold)",
                marginBottom: "var(--space-4)",
              }}
            >
              Appearance
            </h2>
            <p
              style={{
                color: "var(--color-text-secondary)",
                fontSize: "var(--text-sm)",
              }}
            >
              Current theme: <strong>{theme}</strong>. Use the moon/sun icon in
              the sidebar to switch.
            </p>
          </section>

          {/* S3 Sync */}
          <section className="card">
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: "var(--space-4)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
                <Cloud size={18} style={{ color: "var(--color-primary)" }} />
                <h2
                  style={{
                    fontSize: "var(--text-lg)",
                    fontWeight: "var(--font-weight-semibold)",
                  }}
                >
                  Remote Sync (S3)
                </h2>
              </div>
              <button
                className="btn btn--primary btn--sm"
                onClick={handleAddS3}
              >
                <Plus size={14} />
                Add Connection
              </button>
            </div>

            <p
              style={{
                color: "var(--color-text-secondary)",
                fontSize: "var(--text-sm)",
                marginBottom: "var(--space-4)",
              }}
            >
              Connect collections to S3-compatible storage (Backblaze B2,
              Cloudflare R2, etc.) for remote sync and sharing.
            </p>

            {s3Configs.length === 0 ? (
              <p
                style={{
                  color: "var(--color-text-tertiary)",
                  fontSize: "var(--text-sm)",
                  fontStyle: "italic",
                }}
              >
                No S3 connections configured yet.
              </p>
            ) : (
              <div className="registry-list">
                {s3Configs.map((cfg) => (
                  <div key={cfg.id} className="registry-item">
                    <div className="registry-item__info">
                      <span className="registry-item__name">
                        {cfg.name}
                      </span>
                      <span className="registry-item__url">
                        {cfg.endpoint}/{cfg.bucket}
                        {cfg.prefix ? `/${cfg.prefix}` : ""}
                      </span>
                      <span className="registry-item__meta">
                        Collection: {getCollectionName(cfg.collection_id)}
                        {cfg.is_public && " · Public"}
                      </span>
                    </div>
                    <div className="registry-item__actions" style={{ display: "flex", gap: "var(--space-1)" }}>
                      <button
                        className="btn btn--ghost btn--icon btn--sm"
                        onClick={() => handleTestS3(cfg.id)}
                        disabled={s3Testing === cfg.id}
                        title="Test connection"
                      >
                        {s3Testing === cfg.id ? (
                          <Loader2 size={14} className="spin" />
                        ) : (
                          <Zap size={14} />
                        )}
                      </button>
                      {cfg.is_public && (
                        <button
                          className="btn btn--ghost btn--icon btn--sm"
                          onClick={() => handleCopyPublicUrl(cfg.id)}
                          title="Copy public index URL"
                        >
                          <Copy size={14} />
                        </button>
                      )}
                      <button
                        className="btn btn--ghost btn--icon btn--sm"
                        onClick={() => handleEditS3(cfg)}
                        title="Edit connection"
                      >
                        <ExternalLink size={14} />
                      </button>
                      <button
                        className="btn btn--ghost btn--icon btn--sm"
                        onClick={() => handleDeleteS3Config(cfg.id)}
                        title="Remove connection"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* System Diagnostics */}
          <section className="card">
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: "var(--space-4)",
              }}
            >
              <h2
                style={{
                  fontSize: "var(--text-lg)",
                  fontWeight: "var(--font-weight-semibold)",
                }}
              >
                System Diagnostics
              </h2>
              <button
                className="btn btn--secondary btn--sm"
                onClick={handleRunDiagnostic}
                disabled={diagnosticRunning}
              >
                {diagnosticRunning ? (
                  <>
                    <Loader2 size={14} className="spin" style={{ marginRight: "var(--space-2)" }} />
                    Running...
                  </>
                ) : (
                  "Run Health Check"
                )}
              </button>
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "auto 1fr",
                gap: "var(--space-2) var(--space-4)",
                fontSize: "var(--text-sm)",
              }}
            >
              <span style={{ color: "var(--color-text-secondary)" }}>Platform:</span>
              <span>{systemInfo?.os} ({systemInfo?.arch})</span>

              <span style={{ color: "var(--color-text-secondary)" }}>Tauri:</span>
              <span>v{systemInfo?.tauriVersion}</span>

              <span style={{ color: "var(--color-text-secondary)" }}>App:</span>
              <span>v{systemInfo?.appVersion}</span>

              <span style={{ color: "var(--color-text-secondary)" }}>Data Dir:</span>
              <span style={{
                wordBreak: "break-all",
                fontFamily: "var(--font-mono)",
                fontSize: "var(--text-xs)",
                color: "var(--color-text-secondary)"
              }}>{systemInfo?.dataDir}</span>
            </div>
          </section>

          {/* About */}
          <section className="card">
            <h2
              style={{
                fontSize: "var(--text-lg)",
                fontWeight: "var(--font-weight-semibold)",
                marginBottom: "var(--space-4)",
              }}
            >
              About
            </h2>
            <p
              style={{
                color: "var(--color-text-secondary)",
                fontSize: "var(--text-sm)",
              }}
              onClick={handleInteractionPulse}
            >
              <strong>FableForge</strong> v0.1.0

              <br />
              Desktop companion for managing custom audio characters.
            </p>
          </section>
        </div>
      </div>

      <AddRegistryDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onRegistryAdded={loadData}
      />

      <S3ConfigDialog
        open={s3DialogOpen}
        onOpenChange={(open) => {
          setS3DialogOpen(open);
          if (!open) setEditingS3Config(undefined);
        }}
        onSaved={loadS3Configs}
        collections={collections}
        existingConfig={editingS3Config}
        existingConfigs={s3Configs}
      />
    </>
  );
}
