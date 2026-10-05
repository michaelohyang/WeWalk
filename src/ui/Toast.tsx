"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import styles from "./Toast.module.css";

type ToastFn = (message: string) => void;
const ToastContext = createContext<ToastFn>(() => {});

/** Wrap the app once; any client component can then `useToast()("Checked in.")`. */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [message, setMessage] = useState<{ text: string; n: number } | null>(null);
  const show = useCallback<ToastFn>(
    (text) => setMessage((m) => ({ text, n: (m?.n ?? 0) + 1 })),
    [],
  );
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => setMessage(null), 3600);
    return () => clearTimeout(t);
  }, [message]);
  return (
    <ToastContext.Provider value={show}>
      {children}
      <div className={styles.region} role="status" aria-live="polite">
        {message && (
          <div key={message.n} className={styles.toast}>
            {message.text}
          </div>
        )}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
