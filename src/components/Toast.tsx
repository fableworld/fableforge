import * as Toast from "@radix-ui/react-toast";
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";
import { clsx } from "clsx";

export type ToastType = "success" | "error" | "info";

interface ToastProps {
  message: string;
  type?: ToastType;
  onOpenChange?: (open: boolean) => void;
}

export function FableToast({ message, type = "info", onOpenChange }: ToastProps) {
  const icons = {
    success: <CheckCircle2 size={18} className="toast__icon--success" />,
    error: <AlertCircle size={18} className="toast__icon--error" />,
    info: <Info size={18} className="toast__icon--info" />,
  };

  return (
    <Toast.Root
      className={clsx("toast-root", `toast-root--${type}`)}
      onOpenChange={onOpenChange}
      duration={4000}
    >
      <div className="toast__content">
        <div className="toast__icon-wrapper">{icons[type]}</div>
        <Toast.Title className="toast__title">{message}</Toast.Title>
      </div>
      <Toast.Close asChild>
        <button className="toast__close-btn" aria-label="Close">
          <X size={14} />
        </button>
      </Toast.Close>
    </Toast.Root>
  );
}
