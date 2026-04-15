'use client';

import { useState, useEffect } from 'react';
import { Star } from 'lucide-react';
import { useWallet } from '@/context/WalletContext';
import { api } from '@/lib/api';

export function WatchButton({ profileAddress }: { profileAddress: string }) {
  const { address, token, isConnected, openConnectModal } = useWallet();
  const [watching, setWatching] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isConnected || !token || address === profileAddress) {
      setLoading(false);
      return;
    }
    api.getWatchStatus(profileAddress, token)
      .then((r) => setWatching(r.watching))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [isConnected, token, profileAddress, address]);

  // Don't render a button for your own profile
  if (isConnected && address === profileAddress) return null;

  async function toggle() {
    if (!isConnected || !token) {
      openConnectModal();
      return;
    }
    setLoading(true);
    try {
      if (watching) {
        await api.unwatchUser(profileAddress, token);
        setWatching(false);
      } else {
        await api.watchUser(profileAddress, token);
        setWatching(true);
      }
    } catch {
      // silently fail — could add a toast here
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={toggle}
      disabled={loading}
      className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 ${
        watching
          ? 'bg-gray-700 hover:bg-red-900/50 hover:text-red-300 text-gray-200 border border-gray-600'
          : 'bg-avian-600 hover:bg-avian-500 text-white'
      }`}
    >
      {loading ? '…' : watching
        ? <><Star className="w-4 h-4 inline mr-1 fill-current" />Watching</>
        : <><Star className="w-4 h-4 inline mr-1" />Watch</>}
    </button>
  );
}
