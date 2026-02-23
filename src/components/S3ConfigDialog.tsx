import { useState, useEffect } from "react";
import { X, Loader2, CheckCircle2, XCircle, Server } from "lucide-react";
import type { S3Config } from "@/stores/s3";
import type { Collection } from "@/lib/schemas";
import { s3Service } from "@/services/s3";
import { useToast } from "@/components/ToastProvider";

interface S3ConfigDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSaved: () => void;
    collections: Collection[];
    existingConfig?: S3Config;
    existingConfigs: S3Config[];
}

export function S3ConfigDialog({
    open,
    onOpenChange,
    onSaved,
    collections,
    existingConfig,
    existingConfigs,
}: S3ConfigDialogProps) {
    const { show: toast } = useToast();

    const [name, setName] = useState("");
    const [endpoint, setEndpoint] = useState("");
    const [region, setRegion] = useState("auto");
    const [bucket, setBucket] = useState("");
    const [prefix, setPrefix] = useState("");
    const [accessKey, setAccessKey] = useState("");
    const [secretKey, setSecretKey] = useState("");
    const [isPublic, setIsPublic] = useState(false);
    const [collectionId, setCollectionId] = useState("");
    const [saving, setSaving] = useState(false);
    const [testing, setTesting] = useState(false);
    const [testResult, setTestResult] = useState<{
        success: boolean;
        message: string;
    } | null>(null);

    const isEditing = !!existingConfig;

    // Populate if editing
    useEffect(() => {
        if (existingConfig) {
            setName(existingConfig.name);
            setEndpoint(existingConfig.endpoint);
            setRegion(existingConfig.region);
            setBucket(existingConfig.bucket);
            setPrefix(existingConfig.prefix ?? "");
            setIsPublic(existingConfig.is_public);
            setCollectionId(existingConfig.collection_id);
            setAccessKey("");
            setSecretKey("");
        } else {
            resetForm();
        }
        setTestResult(null);
    }, [existingConfig, open]);

    function resetForm() {
        setName("");
        setEndpoint("");
        setRegion("auto");
        setBucket("");
        setPrefix("");
        setAccessKey("");
        setSecretKey("");
        setIsPublic(false);
        setCollectionId("");
        setTestResult(null);
    }

    // Collections that don't already have an S3 config (except current)
    const availableCollections = collections.filter(
        (c) =>
            !existingConfigs.some(
                (cfg) =>
                    cfg.collection_id === c.id &&
                    cfg.id !== existingConfig?.id
            )
    );

    const canSave =
        name.trim() &&
        endpoint.trim() &&
        bucket.trim() &&
        collectionId &&
        (isEditing || (accessKey.trim() && secretKey.trim()));

    const canTest = canSave;

    function normalizeEndpoint(url: string): string {
        let trimmed = url.trim().replace(/\/+$/, "");
        if (!trimmed) return "";

        // Strip bucket name from endpoint if present at the end
        // e.g. "https://abc.r2.cloudflarestorage.com/my-bucket" -> "https://abc.r2.cloudflarestorage.com"
        if (bucket && trimmed.toLowerCase().endsWith(`/${bucket.trim().toLowerCase()}`)) {
            trimmed = trimmed.substring(0, trimmed.length - bucket.trim().length - 1);
        }

        if (!trimmed.includes("://")) {
            return `https://${trimmed}`;
        }
        return trimmed;
    }

    async function handleSave() {
        if (!canSave) return;
        setSaving(true);
        try {
            const config: S3Config = {
                id: existingConfig?.id ?? crypto.randomUUID(),
                name: name.trim(),
                endpoint: normalizeEndpoint(endpoint),
                region: region.trim() || "auto",
                bucket: bucket.trim(),
                prefix: prefix.trim() || undefined,
                is_public: isPublic,
                collection_id: collectionId,
            };

            await s3Service.saveConfig(
                config,
                accessKey.trim() || "unchanged",
                secretKey.trim() || "unchanged"
            );

            toast(
                isEditing ? "S3 configuration updated" : "S3 configuration saved",
                "success"
            );
            onSaved();
            onOpenChange(false);
            resetForm();
        } catch (err) {
            toast(`Failed to save: ${err}`, "error");
        } finally {
            setSaving(false);
        }
    }

    async function handleTest() {
        if (!canTest) return;
        setTesting(true);
        setTestResult(null);
        try {
            const config: S3Config = {
                id: existingConfig?.id ?? crypto.randomUUID(),
                name: name.trim(),
                endpoint: normalizeEndpoint(endpoint),
                region: region.trim() || "auto",
                bucket: bucket.trim(),
                prefix: prefix.trim() || undefined,
                is_public: isPublic,
                collection_id: collectionId,
            };

            await s3Service.saveConfig(
                config,
                accessKey.trim() || (isEditing ? "unchanged" : ""),
                secretKey.trim() || (isEditing ? "unchanged" : "")
            );

            const result = await s3Service.testConnection(config.id);
            setTestResult({
                success: result.success,
                message: result.message,
            });

            if (result.success) {
                toast("Connection successful!", "success");
            } else {
                toast("Connection failed", "error");
            }
        } catch (err) {
            setTestResult({
                success: false,
                message: `${err}`,
            });
            toast(`Test failed: ${err}`, "error");
        } finally {
            setTesting(false);
        }
    }

    if (!open) return null;

    return (
        <div className="dialog-overlay" onClick={() => onOpenChange(false)}>
            <div
                className="dialog-content"
                onClick={(e) => e.stopPropagation()}
                style={{ width: "min(540px, 90vw)" }}
            >
                {/* Header */}
                <div className="dialog-header">
                    <h2 className="dialog-title">
                        <Server size={18} />
                        {isEditing ? "Edit S3 Connection" : "New S3 Connection"}
                    </h2>
                    <button
                        className="btn btn--ghost btn--icon btn--sm"
                        onClick={() => onOpenChange(false)}
                    >
                        <X size={16} />
                    </button>
                </div>

                <p className="dialog-description">
                    Connect an S3-compatible bucket (Backblaze B2, Cloudflare R2, MinIO, etc.) to sync your characters.
                </p>

                {/* Form body */}
                <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>

                    {/* Name */}
                    <div className="form-group">
                        <label className="form-label">Name</label>
                        <input
                            className="dialog-input"
                            placeholder="e.g. My Backblaze Bucket"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            autoFocus
                        />
                    </div>

                    {/* Endpoint */}
                    <div className="form-group">
                        <label className="form-label">Endpoint URL</label>
                        <input
                            className="dialog-input"
                            placeholder="https://s3.us-west-001.backblazeb2.com"
                            value={endpoint}
                            onChange={(e) => setEndpoint(e.target.value)}
                        />
                    </div>

                    {/* Region + Bucket */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-3)" }}>
                        <div className="form-group">
                            <label className="form-label">Region</label>
                            <input
                                className="dialog-input"
                                placeholder="auto"
                                value={region}
                                onChange={(e) => setRegion(e.target.value)}
                            />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Bucket</label>
                            <input
                                className="dialog-input"
                                placeholder="my-bucket-name"
                                value={bucket}
                                onChange={(e) => setBucket(e.target.value)}
                            />
                        </div>
                    </div>

                    {/* Prefix */}
                    <div className="form-group">
                        <label className="form-label">
                            Prefix{" "}
                            <span style={{ color: "var(--color-text-tertiary)", fontWeight: "normal", textTransform: "none", letterSpacing: "0" }}>
                                (optional)
                            </span>
                        </label>
                        <input
                            className="dialog-input"
                            placeholder="fableforge/happygang"
                            value={prefix}
                            onChange={(e) => setPrefix(e.target.value)}
                        />
                    </div>

                    {/* Divider */}
                    <div style={{ borderTop: "1px solid var(--color-border-subtle)", margin: "0" }} />

                    {/* Credentials */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-3)" }}>
                        <div className="form-group">
                            <label className="form-label">
                                Access Key{" "}
                                {isEditing && (
                                    <span style={{ color: "var(--color-text-tertiary)", fontWeight: "normal", textTransform: "none", letterSpacing: "0" }}>
                                        (leave blank to keep)
                                    </span>
                                )}
                            </label>
                            <input
                                className="dialog-input"
                                type="password"
                                placeholder={isEditing ? "••••••••" : "Access Key ID"}
                                value={accessKey}
                                onChange={(e) => setAccessKey(e.target.value)}
                                autoComplete="off"
                            />
                        </div>
                        <div className="form-group">
                            <label className="form-label">
                                Secret Key{" "}
                                {isEditing && (
                                    <span style={{ color: "var(--color-text-tertiary)", fontWeight: "normal", textTransform: "none", letterSpacing: "0" }}>
                                        (leave blank to keep)
                                    </span>
                                )}
                            </label>
                            <input
                                className="dialog-input"
                                type="password"
                                placeholder={isEditing ? "••••••••" : "Secret Access Key"}
                                value={secretKey}
                                onChange={(e) => setSecretKey(e.target.value)}
                                autoComplete="off"
                            />
                        </div>
                    </div>

                    {/* Divider */}
                    <div style={{ borderTop: "1px solid var(--color-border-subtle)", margin: "0" }} />

                    {/* Collection */}
                    <div className="form-group">
                        <label className="form-label">Linked Collection</label>
                        <select
                            className="dialog-input"
                            value={collectionId}
                            onChange={(e) => setCollectionId(e.target.value)}
                        >
                            <option value="">Select a collection…</option>
                            {availableCollections.map((c) => (
                                <option key={c.id} value={c.id}>
                                    {c.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Public toggle */}
                    <label
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "var(--space-2)",
                            cursor: "pointer",
                            fontSize: "var(--text-sm)",
                            color: "var(--color-text-secondary)",
                        }}
                    >
                        <input
                            type="checkbox"
                            checked={isPublic}
                            onChange={(e) => setIsPublic(e.target.checked)}
                            style={{ accentColor: "var(--color-primary-500)" }}
                        />
                        Bucket is publicly readable
                    </label>

                    {/* Test result banner */}
                    {testResult && (
                        <div
                            style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "var(--space-2)",
                                padding: "var(--space-3)",
                                borderRadius: "var(--radius-md)",
                                backgroundColor: testResult.success
                                    ? "rgba(34, 197, 94, 0.08)"
                                    : "rgba(239, 68, 68, 0.08)",
                                fontSize: "var(--text-sm)",
                                color: testResult.success
                                    ? "var(--color-success-500)"
                                    : "var(--color-danger-500)",
                            }}
                        >
                            {testResult.success ? (
                                <CheckCircle2 size={16} style={{ flexShrink: 0 }} />
                            ) : (
                                <XCircle size={16} style={{ flexShrink: 0 }} />
                            )}
                            <span style={{ wordBreak: "break-word" }}>{testResult.message}</span>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="dialog-actions">
                    <button
                        className="btn btn--secondary"
                        onClick={handleTest}
                        disabled={!canTest || testing || saving}
                    >
                        {testing ? (
                            <>
                                <Loader2 size={14} className="spin" />
                                Testing…
                            </>
                        ) : (
                            "Test Connection"
                        )}
                    </button>
                    <div style={{ flex: 1 }} />
                    <button
                        className="btn btn--ghost"
                        onClick={() => onOpenChange(false)}
                        disabled={saving}
                    >
                        Cancel
                    </button>
                    <button
                        className="btn btn--primary"
                        onClick={handleSave}
                        disabled={!canSave || saving}
                    >
                        {saving ? (
                            <>
                                <Loader2 size={14} className="spin" />
                                Saving…
                            </>
                        ) : isEditing ? (
                            "Update"
                        ) : (
                            "Save"
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
