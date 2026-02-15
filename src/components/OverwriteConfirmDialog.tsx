import * as Dialog from "@radix-ui/react-dialog";
import { AlertTriangle, X } from "lucide-react";

interface OverwriteConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  slotIndex: number;
  currentName: string;
  currentTrackCount: number;
  newCharacterName: string;
  onOverwrite: () => void;
  onChangeSlot: () => void;
}

export function OverwriteConfirmDialog({
  open,
  onOpenChange,
  slotIndex,
  currentName,
  currentTrackCount,
  newCharacterName,
  onOverwrite,
  onChangeSlot,
}: OverwriteConfirmDialogProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content className="dialog-content">
          <div className="dialog-header">
            <Dialog.Title className="dialog-title">
              <AlertTriangle size={18} className="overwrite-warning-icon" />
              Slot Occupied
            </Dialog.Title>
            <Dialog.Close asChild>
              <button className="btn btn--ghost btn--icon btn--sm">
                <X size={16} />
              </button>
            </Dialog.Close>
          </div>

          <Dialog.Description className="dialog-description">
            Slot {slotIndex} already contains content. Writing here will replace
            the existing data.
          </Dialog.Description>

          <div className="overwrite-compare">
            <div className="overwrite-compare__item overwrite-compare__item--current">
              <span className="overwrite-compare__label">Currently installed</span>
              <span className="overwrite-compare__name">{currentName}</span>
              <span className="overwrite-compare__meta">
                {currentTrackCount} track{currentTrackCount !== 1 ? "s" : ""}
              </span>
            </div>
            <div className="overwrite-compare__arrow">→</div>
            <div className="overwrite-compare__item overwrite-compare__item--new">
              <span className="overwrite-compare__label">Will be written</span>
              <span className="overwrite-compare__name">{newCharacterName}</span>
            </div>
          </div>

          <div className="dialog-actions">
            <button
              className="btn btn--secondary"
              onClick={onChangeSlot}
            >
              Change Slot
            </button>
            <button
              className="btn btn--primary btn--danger"
              onClick={onOverwrite}
            >
              Overwrite
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
