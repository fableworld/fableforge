import * as Dialog from "@radix-ui/react-dialog";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";
import type { WriteProgress } from "@/stores/device";

interface WriteProgressDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  progress: WriteProgress;
  onRetry?: () => void;
}

export function WriteProgressDialog({
  open,
  onOpenChange,
  progress,
  onRetry,
}: WriteProgressDialogProps) {
  const percent =
    progress.total > 0
      ? Math.round((progress.current / progress.total) * 100)
      : 0;

  const isDone = progress.status === "done";
  const isError = progress.status === "error";
  const isWriting = progress.status === "writing";

  return (
    <Dialog.Root open={open} onOpenChange={isDone || isError ? onOpenChange : undefined}>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content className="dialog-content">
          <Dialog.Title className="dialog-title" style={{ textAlign: "center" }}>
            {isDone ? "Write Complete" : isError ? "Write Failed" : "Writing to Device..."}
          </Dialog.Title>

          <div className="write-progress">
            {/* Progress bar */}
            <div className="write-progress__bar-bg">
              <div
                className={`write-progress__bar-fill ${isDone ? "write-progress__bar-fill--done" : ""} ${isError ? "write-progress__bar-fill--error" : ""}`}
                style={{ width: `${percent}%` }}
              />
            </div>

            {/* Status text */}
            <div className="write-progress__status">
              {isWriting && (
                <>
                  <Loader2 size={14} className="spin" />
                  <span>
                    Track {progress.current + 1} of {progress.total}
                    {progress.trackName && ` — ${progress.trackName}`}
                  </span>
                </>
              )}
              {isDone && (
                <>
                  <CheckCircle2 size={16} className="write-progress__icon--success" />
                  <span>
                    All {progress.total} track{progress.total !== 1 ? "s" : ""} written
                    successfully!
                  </span>
                </>
              )}
              {isError && (
                <>
                  <XCircle size={16} className="write-progress__icon--error" />
                  <span>
                    Error writing track {progress.current + 1}
                    {progress.trackName && `: ${progress.trackName}`}
                  </span>
                </>
              )}
            </div>

            {/* Actions */}
            <div className="write-progress__actions">
              {isDone && (
                <Dialog.Close asChild>
                  <button className="btn btn--primary">Done</button>
                </Dialog.Close>
              )}
              {isError && (
                <div style={{ display: "flex", gap: "var(--space-2)" }}>
                  {onRetry && (
                    <button className="btn btn--primary" onClick={onRetry}>
                      Retry
                    </button>
                  )}
                  <Dialog.Close asChild>
                    <button className="btn btn--secondary">Close</button>
                  </Dialog.Close>
                </div>
              )}
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
