import { useState, useEffect } from "react";
import { X, Loader2, CheckCircle2, XCircle } from "lucide-react";
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
            // Credentials are not pre-filled (they're in keyring)
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

    async function handleSave() {
        if (!canSave) return;
        setSaving(true);
        try {
            const config: S3Config = {
                id: existingConfig?.id ?? crypto.randomUUID(),
                name: name.trim(),
                endpoint: endpoint.trim().replace(/\/+$/, ""),
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
            // Save first so test can find the config
            const config: S3Config = {
                id: existingConfig?.id ?? crypto.randomUUID(),
                name: name.trim(),
                endpoint: endpoint.trim().replace(/\/+$/, ""),
                region: region.trim() || "auto",
                bucket: bucket.trim(),
                prefix: prefix.trim() || undefined,
                is_public: isPublic,
                collection_id: collectionId,
            };

            await s3Service.saveConfig(
                config,
                accessKey.trim(),
                secretKey.trim()
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
                className="dialog"
                onClick={(e) => e.stopPropagation()}
                style={{ maxWidth: "540px" }}
            >
                <div className="dialog__header">
                    <h2 className="dialog__title">
                        {isEditing ? "Edit S3 Connection" : "New S3 Connection"}
                    </h2>
                    <button
                        className="btn btn--ghost btn--icon btn--sm"
                        onClick={() => onOpenChange(false)}
                    >
                        <X size={16} />
                    </button>
                </div>

                <div className="dialog__body" style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
                    {/* Name */}
                    <div className="form-field">
                        <label className="form-label">Name</label>
                        <input
                            className="form-input"
                            placeholder="e.g. My Backblaze Bucket"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                        />
                    </div>

                    {/* Endpoint */}
                    <div className="form-field">
                        <label className="form-label">Endpoint URL</label>
                        <input
                            className="form-input"
                            placeholder="https://s3.us-west-001.backblazeb2.com"
                            value={endpoint}
                            onChange={(e) => setEndpoint(e.target.value)}
                        />
                        <span className="form-hint">
                            S3-compatible endpoint (Backblaze, Cloudflare R2, MinIO, etc.)
                        </span>
                    </div>

                    {/* Region + Bucket (side by side) */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-3)" }}>
                        <div className="form-field">
                            <label className="form-label">Region</label>
                            <input
                                className="form-input"
                                placeholder="auto"
                                value={region}
                                onChange={(e) => setRegion(e.target.value)}
                            />
                        </div>
                        <div className="form-field">
                            <label className="form-label">Bucket</label>
                            <input
                                className="form-input"
                                placeholder="my-bucket-name"
                                value={bucket}
                                onChange={(e) => setBucket(e.target.value)}
                            />
                        </div>
                    </div>

                    {/* Prefix */}
                    <div className="form-field">
                        <label className="form-label">
                            Prefix <span style={{ color: "var(--color-text-tertiary)", fontWeight: "normal" }}>(optional)</span>
                        </label>
                        <input
                            className="form-input"
                            placeholder="fableforge/happygang"
                            value={prefix}
                            onChange={(e) => setPrefix(e.target.value)}
                        />
                        <span className="form-hint">
                            Subdirectory path within the bucket. Leave empty to use bucket root.
                        </span>
                    </div>

                    {/* Credentials */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-3)" }}>
                        <div className="form-field">
                            <label className="form-label">
                                Access Key {isEditing && <span style={{ color: "var(--color-text-tertiary)", fontWeight: "normal" }}>(leave blank to keep)</span>}
                            </label>
                            <input
                                className="form-input"
                                type="password"
                                placeholder={isEditing ? "••••••••" : "Access Key ID"}
                                value={accessKey}
                                onChange={(e) => setAccessKey(e.target.value)}
                                autoComplete="off"
                            />
                        </div>
                        <div className="form-field">
                            <label className="form-label">
                                Secret Key {isEditing && <span style={{ color: "var(--color-text-tertiary)", fontWeight: "normal" }}>(leave blank to keep)</span>}
                            </label>
                            <input
                                className="form-input"
                                type="password"
                                placeholder={isEditing ? "••••••••" : "Secret Access Key"}
                                value={secretKey}
                                onChange={(e) => setSecretKey(e.target.value)}
                                autoComplete="off"
                            />
                        </div>
                    </div>

                    {/* Collection */}
                    <div className="form-field">
                        <label className="form-label">Linked Collection</label>
                        <select
                            className="form-input"
                            value={collectionId}
                            onChange={(e) => setCollectionId(e.target.value)}
                        >
                            <option value="">Select a collection...</option>
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
                        }}
                    >
                        <input
                            type="checkbox"
                            checked={isPublic}
                            onChange={(e) => setIsPublic(e.target.checked)}
                        />
                        Bucket is publicly readable
                    </label>

                    {/* Test result */}
                    {testResult && (
                        <div
                            style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "var(--space-2)",
                                padding: "var(--space-3)",
                                borderRadius: "var(--radius-md)",
                                backgroundColor: testResult.success
                                    ? "var(--color-success-bg, rgba(34, 197, 94, 0.1))"
                                    : "var(--color-error-bg, rgba(239, 68, 68, 0.1))",
                                fontSize: "var(--text-sm)",
                                color: testResult.success
                                    ? "var(--color-success, #22c55e)"
                                    : "var(--color-error, #ef4444)",
                            }}
                        >
                            {testResult.success ? (
                                <CheckCircle2 size={16} />
                            ) : (
                                <XCircle size={16} />
                            )}
                            <span style={{ wordBreak: "break-word" }}>{testResult.message}</span>
                        </div>
                    )}
                </div>

                <div className="dialog__footer">
                    <button
                        className="btn btn--secondary"
                        onClick={handleTest}
                        disabled={!canTest || testing || saving}
                    >
                        {testing ? (
                            <>
                                <Loader2 size={14} className="spin" />
                                Testing...
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
                                Saving...
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
