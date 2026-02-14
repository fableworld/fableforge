import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X, Loader2, Globe } from "lucide-react";
import { registryService } from "@/services/registry";

interface AddRegistryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRegistryAdded: () => void;
}

export function AddRegistryDialog({
  open,
  onOpenChange,
  onRegistryAdded,
}: AddRegistryDialogProps) {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    name: string;
    count: number;
    skipped: number;
  } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const { registry, skippedCount } = await registryService.fetchRegistry(
        url.trim()
      );
      setResult({
        name: registry.meta.name,
        count: registry.characters.length,
        skipped: skippedCount,
      });
      onRegistryAdded();
      // Close after a short delay to show success
      setTimeout(() => {
        onOpenChange(false);
        setUrl("");
        setResult(null);
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content className="dialog-content">
          <div className="dialog-header">
            <Dialog.Title className="dialog-title">
              <Globe size={18} />
              Add Registry
            </Dialog.Title>
            <Dialog.Close asChild>
              <button className="btn btn--ghost btn--icon btn--sm">
                <X size={16} />
              </button>
            </Dialog.Close>
          </div>

          <Dialog.Description className="dialog-description">
            Enter the URL of an OpenFable-compatible registry JSON file.
          </Dialog.Description>

          <form onSubmit={handleSubmit}>
            <input
              type="url"
              className="dialog-input"
              placeholder="https://example.com/registry.json"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              disabled={loading}
              required
              autoFocus
            />

            {error && <div className="dialog-error">{error}</div>}

            {result && (
              <div className="dialog-success">
                ✓ Added <strong>{result.name}</strong> — {result.count}{" "}
                characters loaded
                {result.skipped > 0 && ` (${result.skipped} skipped)`}
              </div>
            )}

            <div className="dialog-actions">
              <Dialog.Close asChild>
                <button type="button" className="btn btn--secondary">
                  Cancel
                </button>
              </Dialog.Close>
              <button
                type="submit"
                className="btn btn--primary"
                disabled={loading || !url.trim()}
              >
                {loading ? (
                  <>
                    <Loader2 size={14} className="spin" />
                    Fetching...
                  </>
                ) : (
                  "Add Registry"
                )}
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
