'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { api } from '../lib/api';
import { getSocket } from '../lib/socket';

export interface AppNotification {
  id: string;
  type: string;
  title: string;
  body: string;
  link: string | null;
  read: boolean;
  createdAt: string;
}

export function useNotifications(address: string | null, token: string | null) {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const tokenRef = useRef(token);
  tokenRef.current = token;

  // Derived: update unreadCount whenever notifications changes
  useEffect(() => {
    setUnreadCount(notifications.filter((n) => !n.read).length);
  }, [notifications]);

  const load = useCallback(async () => {
    if (!tokenRef.current) return;
    setLoading(true);
    try {
      const data = await api.getNotifications(tokenRef.current);
      setNotifications(data);
    } finally {
      setLoading(false);
    }
  }, []);

  const markRead = useCallback(async (id: string) => {
    if (!tokenRef.current) return;
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
    await api.markNotificationRead(id, tokenRef.current);
  }, []);

  const markAllRead = useCallback(async () => {
    if (!tokenRef.current) return;
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    await api.markAllNotificationsRead(tokenRef.current);
  }, []);

  const deleteOne = useCallback(async (id: string) => {
    if (!tokenRef.current) return;
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    await api.deleteNotification(id, tokenRef.current);
  }, []);

  const deleteAll = useCallback(async () => {
    if (!tokenRef.current) return;
    setNotifications([]);
    await api.deleteAllNotifications(tokenRef.current);
  }, []);

  // Load on mount / when token changes
  useEffect(() => {
    if (token) load();
    else setNotifications([]);
  }, [token, load]);

  // Subscribe via WebSocket for real-time push
  useEffect(() => {
    if (!address) return;

    let alive = true;
    let offFn: (() => void) | null = null;

    getSocket().then((s) => {
      if (!alive) return;

      const subscribe = () => s.emit('subscribe:address', address);

      // Subscribe now (and re-subscribe on every reconnect)
      subscribe();
      s.on('connect', subscribe);

      const handler = (notification: AppNotification) => {
        if (!alive) return;
        setNotifications((prev) => [notification, ...prev]);
      };

      s.on('notification', handler);
      offFn = () => {
        s.off('connect', subscribe);
        s.off('notification', handler);
      };
    });

    return () => {
      alive = false;
      offFn?.();
    };
  }, [address]);

  return { notifications, unreadCount, loading, load, markRead, markAllRead, deleteOne, deleteAll };
}
