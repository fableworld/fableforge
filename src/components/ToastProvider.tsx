import React, { createContext, useContext, useState, useCallback, useMemo } from "react";
import * as Toast from "@radix-ui/react-toast";
import { FableToast, type ToastType } from "@/components/Toast";

interface ToastContextValue {
  show: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}

interface ToastInstance {
  id: string;
  message: string;
  type: ToastType;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastInstance[]>([]);

  const show = useCallback((message: string, type: ToastType = "info") => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);
  }, []);

  const remove = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const value = useMemo(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={value}>
      <Toast.Provider swipeDirection="right">
        {children}
        
        {toasts.map((toast) => (
          <FableToast
            key={toast.id}
            message={toast.message}
            type={toast.type}
            onOpenChange={(open: boolean) => {
              if (!open) {
                // Remove from local state after transition
                setTimeout(() => remove(toast.id), 200);
              }
            }}
          />
        ))}

        <Toast.Viewport className="toast-viewport" />
      </Toast.Provider>
    </ToastContext.Provider>
  );
}
