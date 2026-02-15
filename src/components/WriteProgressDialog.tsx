import * as Dialog from "@radix-ui/react-dialog";
import { CheckCircle2, XCircle, Loader2, Smartphone } from "lucide-react";
import type { WriteProgress } from "@/stores/device";
import { QRCodeSVG } from "qrcode.react";

interface WriteProgressDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  progress: WriteProgress;
  nfcPayload?: string;
  onRetry?: () => void;
}

export function WriteProgressDialog({
  open,
  onOpenChange,
  progress,
  nfcPayload,
  onRetry,
}: WriteProgressDialogProps) {
  const percent =
    progress.total > 0
      ? Math.round((progress.current / progress.total) * 100)
      : 0;

  const isDone = progress.status === "done";
  const isError = progress.status === "error";
  const isEncoding = progress.status === "encoding";
  const isWriting = progress.status === "writing";

  // The URI scheme for FableForge NFC Write
  const nfcUri = nfcPayload ? `fableforge-nfcwrite://${nfcPayload}` : undefined;

  return (
    <Dialog.Root open={open} onOpenChange={isDone || isError ? onOpenChange : undefined}>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content className="dialog-content">
          <Dialog.Title className="dialog-title" style={{ textAlign: "center" }}>
            {isDone ? "Character Ready!" : isError ? "Write Failed" : isEncoding ? "Encoding Tracks..." : "Writing to Device..."}
          </Dialog.Title>

          <div className="write-progress">
            {/* Progress bar */}
            {!isDone && (
              <div className="write-progress__bar-bg">
                <div
                  className={`write-progress__bar-fill ${isError ? "write-progress__bar-fill--error" : ""}`}
                  style={{ width: `${percent}%` }}
                />
              </div>
            )}

            {/* Status text */}
            <div className="write-progress__status">
              {(isWriting || isEncoding) && (
                <>
                  <Loader2 size={14} className="spin" />
                  <span>
                    {isEncoding ? "Preparing files..." : (
                      <>
                        Track {progress.current + 1} of {progress.total}
                        {progress.trackName && ` — ${progress.trackName}`}
                      </>
                    )}
                  </span>
                </>
              )}
              {isDone && (
                <div className="write-success-flow">
                  <div className="write-success-header">
                    <CheckCircle2 size={24} className="write-progress__icon--success" />
                    <span>Writing successful!</span>
                  </div>

                  {nfcUri && (
                    <div className="nfc-qr-section">
                      <p className="nfc-qr-instruction">
                        Scan this code with the FabaForge Mobile App to link your character to an NFC tag.
                      </p>
                      <div className="nfc-qr-container">
                        <QRCodeSVG value={nfcUri} size={160} level="H" includeMargin />
                      </div>
                      <div className="nfc-payload-badge">
                        <Smartphone size={12} />
                        <code>{nfcPayload}</code>
                      </div>
                    </div>
                  )}
                </div>
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
