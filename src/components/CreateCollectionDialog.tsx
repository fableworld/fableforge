import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X, FolderPlus } from "lucide-react";

interface CreateCollectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (name: string, description?: string) => void;
}

export function CreateCollectionDialog({
  open,
  onOpenChange,
  onCreate,
}: CreateCollectionDialogProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onCreate(name.trim(), description.trim() || undefined);
    setName("");
    setDescription("");
    onOpenChange(false);
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content className="dialog-content">
          <div className="dialog-header">
            <Dialog.Title className="dialog-title">
              <FolderPlus size={18} />
              New Collection
            </Dialog.Title>
            <Dialog.Close asChild>
              <button className="btn btn--ghost btn--icon btn--sm">
                <X size={16} />
              </button>
            </Dialog.Close>
          </div>

          <Dialog.Description className="dialog-description">
            Create a collection to organize your custom characters.
          </Dialog.Description>

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Name</label>
              <input
                type="text"
                className="dialog-input"
                placeholder="My Collection"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                autoFocus
              />
            </div>
            <div className="form-group" style={{ marginTop: "var(--space-3)" }}>
              <label className="form-label">Description (optional)</label>
              <textarea
                className="dialog-input"
                placeholder="A short description..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                style={{ resize: "vertical" }}
              />
            </div>

            <div className="dialog-actions">
              <Dialog.Close asChild>
                <button type="button" className="btn btn--secondary">
                  Cancel
                </button>
              </Dialog.Close>
              <button
                type="submit"
                className="btn btn--primary"
                disabled={!name.trim()}
              >
                Create
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
