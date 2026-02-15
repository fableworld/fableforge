import * as Dialog from "@radix-ui/react-dialog";
import { AlertTriangle, RotateCcw, CheckCircle2 } from "lucide-react";
import { useState } from "react";
import { deviceService, type PendingOperation } from "@/services/device";
import { useToast } from "@/components/ToastProvider";

interface RecoveryDialogProps {
  operations: PendingOperation[];
  onResolved: () => void;
}

export function RecoveryDialog({ operations, onResolved }: RecoveryDialogProps) {
  const [loading, setLoading] = useState<number | null>(null);
  const { show: toast } = useToast();

  if (operations.length === 0) return null;

  const handleRollback = async (op: PendingOperation) => {
    setLoading(op.id);
    try {
      await deviceService.rollbackPendingOperation(op.id, op.slotIndex);
      toast("Operation rolled back successfully", "success");
      onResolved();
    } catch (error) {
      console.error("Rollback failed:", error);
      toast("Failed to rollback operation", "error");
    } finally {
      setLoading(null);
    }
  };

  const handleCompleteDelete = async (op: PendingOperation) => {
    setLoading(op.id);
    try {
      await deviceService.completePendingDelete(op.id, op.slotIndex);
      toast("Cleanup completed successfully", "success");
      onResolved();
    } catch (error) {
      console.error("Cleanup failed:", error);
      toast("Failed to complete cleanup", "error");
    } finally {
      setLoading(null);
    }
  };

  return (
    <Dialog.Root open={operations.length > 0}>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content className="dialog-content">
          <div className="dialog-header">
            <div className="dialog-header__icon warning">
              <AlertTriangle size={20} />
            </div>
            <div style={{ flex: 1 }}>
              <Dialog.Title className="dialog-title">
                Unfinished Operations Found
              </Dialog.Title>
              <Dialog.Description className="dialog-description">
                Interrupted operations were detected on your device. Please resolve them to ensure data integrity.
              </Dialog.Description>
            </div>
          </div>

          <div className="recovery-list">
            {operations.map((op) => (
              <div key={op.id} className="recovery-item">
                <div className="recovery-item__info">
                  <div className="recovery-item__type">
                    {op.operation === "write" ? "Write Interrupted" : "Delete Interrupted"}
                  </div>
                  <div className="recovery-item__slot">Slot {op.slotIndex + 1}</div>
                  <div className="recovery-item__time">
                    Started at {new Date(op.startedAt).toLocaleString()}
                  </div>
                </div>

                <div className="recovery-item__actions">
                  {op.operation === "write" || op.operation === "upgrade" ? (
                    <button
                      className="btn btn--secondary btn--sm"
                      onClick={() => handleRollback(op)}
                      disabled={loading !== null}
                    >
                      {loading === op.id ? (
                        <RotateCcw size={14} className="spin" />
                      ) : (
                        <RotateCcw size={14} />
                      )}
                      Rollback
                    </button>
                  ) : (
                    <button
                      className="btn btn--secondary btn--sm"
                      onClick={() => handleCompleteDelete(op)}
                      disabled={loading !== null}
                    >
                      {loading === op.id ? (
                        <CheckCircle2 size={14} className="spin" />
                      ) : (
                        <CheckCircle2 size={14} />
                      )}
                      Complete Cleanup
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="dialog-actions">
            <button
              className="btn btn--ghost btn--sm"
              onClick={onResolved} // This just hides it for now, but it'll reappear next time
            >
              Resolve Later
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
