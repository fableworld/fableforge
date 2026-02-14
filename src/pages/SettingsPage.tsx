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
import { AddRegistryDialog } from "@/components/AddRegistryDialog";

export function SettingsPage() {
  const [theme] = useAtom(themeAtom);
  const [registries, setRegistries] = useAtom(registriesAtom);
  const setCharacters = useSetAtom(charactersAtom);
  const [stats] = useAtom(registryStatsAtom);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    const data = await registryService.loadAll();
    setRegistries(data.registries);
    setCharacters(data.characters);
  }, [setRegistries, setCharacters]);

  useEffect(() => {
    loadData();
  }, [loadData]);

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
