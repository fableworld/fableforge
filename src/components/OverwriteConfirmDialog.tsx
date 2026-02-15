import * as Dialog from "@radix-ui/react-dialog";
import { AlertTriangle, X, RefreshCw } from "lucide-react";
import type { SlotCheckResult } from "@/services/device";

interface OverwriteConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  slotIndex: number;
  checkResult: SlotCheckResult;
  onConfirm: () => void;
}

export function OverwriteConfirmDialog({
  open,
  onOpenChange,
  slotIndex,
  checkResult,
  onConfirm,
}: OverwriteConfirmDialogProps) {
  const isUpdate = checkResult.type === "sameCharacterDifferentContent";
  const isReinstall = checkResult.type === "sameCharacterSameContent";
  const isDifferent = checkResult.type === "differentCharacter";
  const isInconsistent = checkResult.type === "inconsistent";

  const getTitle = () => {
    if (isUpdate) return "Update Character";
    if (isReinstall) return "Character Already Present";
    return "Slot Occupied";
  };

  const getDescription = () => {
    if (isUpdate) {
      return `A different version of "${checkResult.characterName}" is already on slot ${slotIndex}. Do you want to update it?`;
    }
    if (isReinstall) {
      return `"${checkResult.characterName}" is already on slot ${slotIndex} and appears to be identical. Re-install anyway?`;
    }
    if (isDifferent) {
      return `Slot ${slotIndex} is occupied by "${checkResult.existingCharacterName}". Writing here will replace it.`;
    }
    if (isInconsistent) {
      return `Slot ${slotIndex} contains ${checkResult.fileCount} file(s) not recognized by FableForge. Overwrite them?`;
    }
    return `Slot ${slotIndex} already contains content. Writing here will replace the existing data.`;
  };

  const getIcon = () => {
    if (isUpdate) return <RefreshCw size={18} className="text-primary" />;
    return <AlertTriangle size={18} className="overwrite-warning-icon" />;
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content className="dialog-content">
          <div className="dialog-header">
            <Dialog.Title className="dialog-title">
              {getIcon()}
              {getTitle()}
            </Dialog.Title>
            <Dialog.Close asChild>
              <button className="btn btn--ghost btn--icon btn--sm">
                <X size={16} />
              </button>
            </Dialog.Close>
          </div>

          <Dialog.Description className="dialog-description">
            {getDescription()}
          </Dialog.Description>

          {isDifferent && (
            <div className="overwrite-compare" style={{ marginTop: "var(--space-4)" }}>
              <div className="overwrite-compare__item overwrite-compare__item--current">
                <span className="overwrite-compare__label">Current</span>
                <span className="overwrite-compare__name">
                  {checkResult.existingCharacterName}
                </span>
              </div>
              <div className="overwrite-compare__arrow">→</div>
              <div className="overwrite-compare__item overwrite-compare__item--new">
                <span className="overwrite-compare__label">New</span>
                <span className="overwrite-compare__name">Target Slot {slotIndex}</span>
              </div>
            </div>
          )}

          <div className="dialog-actions">
            <Dialog.Close asChild>
              <button className="btn btn--secondary">Cancel</button>
            </Dialog.Close>
            <button
              className={`btn btn--primary ${!isUpdate && !isReinstall ? "btn--danger" : ""}`}
              onClick={onConfirm}
            >
              {isUpdate ? "Update" : isReinstall ? "Re-install" : "Overwrite"}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
