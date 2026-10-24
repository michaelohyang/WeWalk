"use client";

import * as RadixToast from "@radix-ui/react-toast";
import { createContext, useCallback, useContext, useRef, useState } from "react";
import styles from "./Toast.module.css";

type ToastFn = (message: string) => void;
const ToastContext = createContext<ToastFn>(() => {});

/**
 * Wrap the app once; any client component can then `useToast()("Checked in.")`. A new message
 * replaces the one showing. Radix announces each to screen readers, pauses the timer while it's
 * hovered or focused, and lets you swipe it away (or reach it with F8).
 */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [message, setMessage] = useState<{ text: string; id: number } | null>(null);
  const lastId = useRef(0);
  const show = useCallback<ToastFn>((text) => setMessage({ text, id: ++lastId.current }), []);
  return (
    <ToastContext.Provider value={show}>
      <RadixToast.Provider duration={3600} swipeDirection="up">
        {children}
        {message && (
          <RadixToast.Root
            key={message.id}
            className={styles.toast}
            onOpenChange={(open) => {
              if (!open) setMessage((m) => (m?.id === message.id ? null : m));
            }}
          >
            <RadixToast.Description>{message.text}</RadixToast.Description>
          </RadixToast.Root>
        )}
        <RadixToast.Viewport className={styles.region} />
      </RadixToast.Provider>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
