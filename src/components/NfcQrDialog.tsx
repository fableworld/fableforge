import * as Dialog from "@radix-ui/react-dialog";
import { Smartphone, X } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";

interface NfcQrDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  nfcPayload: string;
}

export function NfcQrDialog({ open, onOpenChange, nfcPayload }: NfcQrDialogProps) {
  const nfcUri = `https://openfable.d71.dev/nfc-write?payl=${nfcPayload}`;

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content className="dialog-content">
          <div className="dialog-header">
            <Dialog.Title className="dialog-title">Write to NFC Tag</Dialog.Title>
            <Dialog.Close asChild>
              <button className="btn btn--icon btn--ghost btn--sm" aria-label="Close">
                <X size={16} />
              </button>
            </Dialog.Close>
          </div>

          <div className="nfc-qr-section" style={{ marginTop: "var(--space-4)" }}>
            <p className="nfc-qr-instruction">
              Scan this code with the FabaForge Mobile App to link your character to an NFC tag.
            </p>
            <div className="nfc-qr-container">
              <QRCodeSVG value={nfcUri} size={200} level="H" includeMargin />
            </div>
            <div className="nfc-payload-badge">
              <Smartphone size={12} />
              <code>{nfcPayload}</code>
            </div>
          </div>

          <div className="dialog-actions">
            <Dialog.Close asChild>
              <button className="btn btn--secondary">Close</button>
            </Dialog.Close>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
