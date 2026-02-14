import { useAtom } from "jotai";
import { themeAtom } from "@/stores/theme";

export function SettingsPage() {
  const [theme] = useAtom(themeAtom);

  return (
    <>
      <header className="main-content__header">
        <h1 className="main-content__title">Settings</h1>
      </header>
      <div className="main-content__body">
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
          {/* Registries Section */}
          <section className="card">
            <h2 style={{ fontSize: "var(--text-lg)", fontWeight: "var(--font-weight-semibold)", marginBottom: "var(--space-4)" }}>
              Registries
            </h2>
            <p style={{ color: "var(--color-text-secondary)", fontSize: "var(--text-sm)", marginBottom: "var(--space-4)" }}>
              Manage external registries to discover characters and collections.
            </p>
            <button className="btn btn--secondary">
              Add Registry
            </button>
          </section>

          {/* Appearance */}
          <section className="card">
            <h2 style={{ fontSize: "var(--text-lg)", fontWeight: "var(--font-weight-semibold)", marginBottom: "var(--space-4)" }}>
              Appearance
            </h2>
            <p style={{ color: "var(--color-text-secondary)", fontSize: "var(--text-sm)" }}>
              Current theme: <strong>{theme}</strong>. Use the moon/sun icon in the sidebar to switch.
            </p>
          </section>

          {/* S3 Sync */}
          <section className="card">
            <h2 style={{ fontSize: "var(--text-lg)", fontWeight: "var(--font-weight-semibold)", marginBottom: "var(--space-4)" }}>
              Remote Sync (S3)
            </h2>
            <p style={{ color: "var(--color-text-secondary)", fontSize: "var(--text-sm)", marginBottom: "var(--space-4)" }}>
              Configure S3-compatible storage for syncing your collections remotely.
            </p>
            <button className="btn btn--secondary" disabled>
              Coming soon
            </button>
          </section>

          {/* About */}
          <section className="card">
            <h2 style={{ fontSize: "var(--text-lg)", fontWeight: "var(--font-weight-semibold)", marginBottom: "var(--space-4)" }}>
              About
            </h2>
            <p style={{ color: "var(--color-text-secondary)", fontSize: "var(--text-sm)" }}>
              <strong>FableForge</strong> v0.1.0
              <br />
              Desktop companion for managing custom audio characters.
            </p>
          </section>
        </div>
      </div>
    </>
  );
}
