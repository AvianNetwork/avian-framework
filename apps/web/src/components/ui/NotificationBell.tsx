'use client';

import { useRef, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useNotifications, type AppNotification } from '../../hooks/useNotifications';
import { useWallet } from '../../context/WalletContext';

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function NotificationBell() {
  const { address, token } = useWallet();
  const { notifications, unreadCount, markRead, markAllRead, deleteOne, deleteAll } = useNotifications(address, token);
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  if (!address) return null;

  async function handleItemClick(n: AppNotification) {
    if (!n.read) await markRead(n.id);
    setOpen(false);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (n.link) router.push(n.link as any);
  }

  function handleDelete(e: React.MouseEvent, id: string) {
    e.stopPropagation();
    deleteOne(id);
  }

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative p-2 rounded-lg hover:bg-gray-800 transition-colors"
        aria-label="Notifications"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="w-5 h-5 text-gray-300"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.8}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 bg-teal-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center leading-none">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
            <span className="font-semibold text-sm text-white">Notifications</span>
            {notifications.length > 0 && (
              <div className="flex items-center gap-3">
                {unreadCount > 0 && (
                  <button
                    onClick={() => markAllRead()}
                    className="text-xs text-teal-400 hover:text-teal-300 transition-colors"
                  >
                    Mark all read
                  </button>
                )}
                <button
                  onClick={() => deleteAll()}
                  className="text-xs text-gray-500 hover:text-red-400 transition-colors"
                >
                  Clear all
                </button>
              </div>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto divide-y divide-gray-800">
            {notifications.length === 0 ? (
              <p className="text-center text-gray-500 text-sm py-8">No notifications yet</p>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  className={`flex items-start gap-3 px-4 py-3 hover:bg-gray-800 transition-colors group ${!n.read ? 'bg-gray-800/50' : ''}`}
                >
                  {/* Clickable content area */}
                  <button
                    onClick={() => handleItemClick(n)}
                    className="flex items-start gap-3 flex-1 min-w-0 text-left"
                  >
                    <div className="flex-shrink-0 pt-1">
                      <span className={`block w-2 h-2 rounded-full ${!n.read ? 'bg-teal-500' : ''}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium truncate ${n.read ? 'text-gray-400' : 'text-white'}`}>
                        {n.title}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{n.body}</p>
                      <p className="text-xs text-gray-600 mt-1">{timeAgo(n.createdAt)}</p>
                    </div>
                  </button>
                  {/* Delete button */}
                  <button
                    onClick={(e) => handleDelete(e, n.id)}
                    className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-gray-700 text-gray-500 hover:text-red-400"
                    aria-label="Delete notification"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

