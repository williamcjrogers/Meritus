"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";

type Notice = { message: string; tone: "success" | "warning" | "info" | "error" };
const ToastContext = createContext<(message: string, tone?: Notice["tone"]) => void>(() => undefined);
export function ToastProvider({ children }: { children: ReactNode }) {
  const [notice, setNotice] = useState<Notice | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const notify = useCallback((message: string, tone: Notice["tone"] = "success") => {
    if (timer.current) clearTimeout(timer.current);
    setNotice({ message, tone });
    timer.current = setTimeout(() => setNotice(null), 6000);
  }, []);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  return <ToastContext.Provider value={notify}>{children}<div className="app-toast-region" aria-live="polite" aria-atomic="true">{notice && <div className={`app-status app-status--${notice.tone} app-toast`}><span>{notice.message}</span><button type="button" className="app-button app-button--ghost" aria-label="Dismiss notification" onClick={() => setNotice(null)}>Close</button></div>}</div></ToastContext.Provider>;
}
export function useToast() { return useContext(ToastContext); }
