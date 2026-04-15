'use client';

import { useEffect, useRef } from 'react';
import { getSocket } from '../lib/socket';

/**
 * Subscribe to real-time updates for a specific listing.
 * Calls `onEvent` whenever the listing is updated, workflow completes, or fails.
 */
export function useListingEvents(listingId: string, onEvent: () => void) {
  const callbackRef = useRef(onEvent);
  callbackRef.current = onEvent;

  useEffect(() => {
    if (!listingId) return;

    let alive = true;
    // Collect off-functions for synchronous cleanup
    const offs: Array<() => void> = [];

    getSocket().then((s) => {
      if (!alive) return;

      const subscribe = () => s.emit('subscribe:listing', listingId);
      subscribe();
      s.on('connect', subscribe);

      const handler = () => {
        if (alive) callbackRef.current();
      };

      s.on('listing:updated', handler);
      s.on('workflow:completed', handler);
      s.on('workflow:failed', handler);

      offs.push(
        () => s.off('connect', subscribe),
        () => s.off('listing:updated', handler),
        () => s.off('workflow:completed', handler),
        () => s.off('workflow:failed', handler),
      );
    });

    return () => {
      alive = false;
      offs.forEach((off) => off());
    };
  }, [listingId]);
}
