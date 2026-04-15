'use client';

import { useEffect, useState } from 'react';
import { setToastListener } from '@/lib/toast';

interface ToastItem {
  id: number;
  message: string;
  type: 'success' | 'error';
}

export function Toaster() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    let next = 0;
    setToastListener((message, type) => {
      setToasts((prev) => {
        // Deduplicate: if this exact message is already visible, skip
        if (prev.some((t) => t.message === message && t.type === type)) return prev;
        // Cap at 3 visible at once (drop oldest)
        const capped = prev.length >= 3 ? prev.slice(1) : prev;
        const id = ++next;
        setTimeout(
          () => setToasts((p) => p.filter((t) => t.id !== id)),
          4500
        );
        return [...capped, { id, message, type }];
      });
    });
    return () => setToastListener(null);
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 inset-x-0 z-[200] flex flex-col items-center gap-2 pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`
            flex items-center gap-2.5 px-5 py-3 rounded-xl shadow-2xl text-sm font-medium
            backdrop-blur-md border
            animate-in fade-in slide-in-from-top-3 duration-300
            ${t.type === 'success'
              ? 'bg-emerald-950/60 text-emerald-200 border-emerald-700/50'
              : 'bg-red-950/60 text-red-200 border-red-700/50'}
          `}
        >
          {t.type === 'success' ? (
            <svg className="w-4 h-4 shrink-0 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            <svg className="w-4 h-4 shrink-0 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          )}
          {t.message}
        </div>
      ))}
    </div>
  );
}
