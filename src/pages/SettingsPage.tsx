import { useState, useEffect, useCallback } from "react";
import { useAtom, useSetAtom } from "jotai";
import { Trash2, RefreshCw, Loader2 } from "lucide-react";
import { themeAtom } from "@/stores/theme";
import {
  registriesAtom,
  charactersAtom,
  registryStatsAtom,
} from "@/stores/registries";
import { registryService } from "@/services/registry";
import { useBufferAnalytics, checkSystemHealth, type SystemInfo } from "@/lib/status";
import { AddRegistryDialog } from "@/components/AddRegistryDialog";
import { invoke } from "@tauri-apps/api/core";
import { useToast } from "@/components/ToastProvider";

export function SettingsPage() {
  const handleInteractionPulse = useBufferAnalytics();
  const [theme] = useAtom(themeAtom);
  const { show } = useToast();

  const [registries, setRegistries] = useAtom(registriesAtom);
  const setCharacters = useSetAtom(charactersAtom);
  const [stats] = useAtom(registryStatsAtom);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null);
  const [diagnosticRunning, setDiagnosticRunning] = useState(false);


  const loadData = useCallback(async () => {
    const data = await registryService.loadAll();
    setRegistries(data.registries);
    setCharacters(data.characters);
  }, [setRegistries, setCharacters]);

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
    loadSystemInfo();
  }, [loadData, loadSystemInfo]);

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
            <h2
              style={{
                fontSize: "var(--text-lg)",
                fontWeight: "var(--font-weight-semibold)",
                marginBottom: "var(--space-4)",
              }}
            >
              Remote Sync (S3)
            </h2>
            <p
              style={{
                color: "var(--color-text-secondary)",
                fontSize: "var(--text-sm)",
                marginBottom: "var(--space-4)",
              }}
            >
              Configure S3-compatible storage for syncing your collections
              remotely.
            </p>
            <button className="btn btn--secondary" disabled>
              Coming soon
            </button>
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
    </>
  );
}
