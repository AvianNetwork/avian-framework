'use client';

import { useEffect, useState, useCallback } from 'react';
import { useWallet } from '@/context/WalletContext';
import { api } from '@/lib/api';
import { toast } from '@/lib/toast';

interface Props {
  type: 'asset' | 'collection';
  id: string;
  /** Pre-fetched initial data to avoid waterfall on SSR pages */
  initialCount?: number;
  initialLiked?: boolean;
}

export function LikeButton({ type, id, initialCount = 0, initialLiked = false }: Props) {
  const { address, token, isConnected } = useWallet();
  const [count, setCount] = useState(initialCount);
  const [liked, setLiked] = useState(initialLiked);
  const [loading, setLoading] = useState(false);

  // Fetch live state once we know the address
  useEffect(() => {
    api.getLikes(type, id, address ?? undefined).then((data) => {
      setCount(data.count);
      setLiked(data.liked);
    }).catch(() => {});
  }, [type, id, address]);

  const handleClick = useCallback(async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isConnected) {
      toast('Connect your wallet to like this.', 'error');
      return;
    }
    if (!token || loading) return;
    setLoading(true);
    // Optimistic update
    const wasLiked = liked;
    setLiked(!wasLiked);
    setCount((c) => wasLiked ? c - 1 : c + 1);
    try {
      const data = await api.toggleLike(type, id, token);
      setCount(data.count);
      setLiked(data.liked);
    } catch {
      // Revert on failure
      setLiked(wasLiked);
      setCount((c) => wasLiked ? c + 1 : c - 1);
    } finally {
      setLoading(false);
    }
  }, [type, id, token, liked, loading]);

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      title={isConnected ? (liked ? 'Unlike' : 'Like') : 'Connect wallet to like'}
      className={`flex items-center gap-1 text-xs px-2 py-1 rounded-md transition-colors
        ${isConnected ? 'cursor-pointer' : 'cursor-default'}
        ${liked
          ? 'text-pink-400 bg-pink-950/40 hover:bg-pink-950/60'
          : 'text-gray-500 hover:text-pink-400 hover:bg-pink-950/30'
        }`}
    >
      <svg
        className={`w-3.5 h-3.5 transition-transform ${liked ? 'scale-110' : ''}`}
        viewBox="0 0 24 24"
        fill={liked ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth={2}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
        />
      </svg>
      {count > 0 && <span>{count}</span>}
    </button>
  );
}
