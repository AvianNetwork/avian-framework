'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { api } from '../../lib/api';

export function SyncBanner() {
  const [syncing, setSyncing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [blocks, setBlocks] = useState(0);
  const [headers, setHeaders] = useState(0);

  useEffect(() => {
    let timer: ReturnType<typeof setInterval>;

    async function check() {
      try {
        const health = await api.getHealth();
        setSyncing(health.syncing);
        setProgress(health.progress);
        setBlocks(health.blocks);
        setHeaders(health.headers);
      } catch {
        // API unreachable — don't show banner (could be network issue)
      }
    }

    check();
    // Poll every 30 seconds while syncing, every 5 minutes once synced
    timer = setInterval(check, syncing ? 30_000 : 300_000);
    return () => clearInterval(timer);
  }, [syncing]);

  if (!syncing) return null;

  return (
    <div className="bg-yellow-900/60 border-b border-yellow-700 text-yellow-200 px-4 py-2 text-sm flex items-center gap-2">
      <AlertTriangle className="h-4 w-4 flex-shrink-0" />
      <span>
        <strong>Node syncing</strong> — {progress}% complete ({blocks.toLocaleString()} / {headers.toLocaleString()} blocks).
        Marketplace operations are temporarily disabled.
      </span>
    </div>
  );
}
