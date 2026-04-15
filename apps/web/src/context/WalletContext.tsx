'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import { api } from '../lib/api';
import { ConnectWalletModal } from '../components/ConnectWalletModal';

const STORAGE_KEY = 'avian_wallet';
const KNOWN_KEY = 'avian_known_addresses';
const SESSIONS_KEY = 'avian_sessions';

interface WalletState {
  address: string;
  token: string;
  expiresAt: string;
}

interface WalletContextValue {
  address: string | null;
  token: string | null;
  isConnected: boolean;
  knownAddresses: string[];
  /** Addresses with a valid non-expired session — the only ones that can be switched to */
  switchableAddresses: string[];
  connect: (address: string, challenge: string, signature: string) => Promise<void>;
  /** Switch to a known address without re-signing. Returns true if a valid session was found. */
  switchTo: (address: string) => boolean;
  disconnect: () => void;
  removeKnownAddress: (address: string) => void;
  openConnectModal: (prefillAddress?: string) => void;
}

const WalletContext = createContext<WalletContextValue>({
  address: null,
  token: null,
  isConnected: false,
  knownAddresses: [],
  switchableAddresses: [],
  connect: async () => {},
  switchTo: () => false,
  disconnect: () => {},
  removeKnownAddress: () => {},
  openConnectModal: () => {},
});

function loadKnownAddresses(): string[] {
  try {
    const stored = localStorage.getItem(KNOWN_KEY);
    return stored ? (JSON.parse(stored) as string[]) : [];
  } catch {
    return [];
  }
}

function saveKnownAddresses(addresses: string[]) {
  localStorage.setItem(KNOWN_KEY, JSON.stringify(addresses));
}

function loadSessions(): Record<string, WalletState> {
  try {
    const stored = sessionStorage.getItem(SESSIONS_KEY);
    return stored ? (JSON.parse(stored) as Record<string, WalletState>) : {};
  } catch {
    return {};
  }
}

function saveSessions(sessions: Record<string, WalletState>) {
  sessionStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
}

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [wallet, setWallet] = useState<WalletState | null>(null);
  const [knownAddresses, setKnownAddresses] = useState<string[]>([]);
  const [connectModalOpen, setConnectModalOpen] = useState(false);
  const [connectModalPrefill, setConnectModalPrefill] = useState<string | undefined>();

  const openConnectModal = useCallback((prefillAddress?: string) => {
    setConnectModalPrefill(prefillAddress);
    setConnectModalOpen(true);
  }, []);

  // Restore from storage on mount
  useEffect(() => {
    setKnownAddresses(loadKnownAddresses());
    try {
      const stored = sessionStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed: WalletState = JSON.parse(stored);
        if (new Date(parsed.expiresAt) > new Date()) {
          setWallet(parsed);
        } else {
          sessionStorage.removeItem(STORAGE_KEY);
        }
      }
    } catch {
      sessionStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  const connect = useCallback(
    async (address: string, challenge: string, signature: string) => {
      const result = await api.verify(address, challenge, signature);
      const state: WalletState = {
        address,
        token: result.token,
        expiresAt: result.expiresAt,
      };
      setWallet(state);
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));

      // Persist session so this address can be switched to later without re-signing
      const sessions = loadSessions();
      sessions[address] = state;
      saveSessions(sessions);

      // Add to known addresses (deduplicated, most-recently-used first)
      setKnownAddresses((prev) => {
        const updated = [address, ...prev.filter((a) => a !== address)];
        saveKnownAddresses(updated);
        return updated;
      });
    },
    []
  );

  // Sync linked wallets from profile into knownAddresses whenever the active session changes
  useEffect(() => {
    if (!wallet) return;
    api.getMyProfile(wallet.token)
      .then((profile) => {
        const p = profile as { wallets?: { address: string }[] };
        const linked = p.wallets?.map((w) => w.address) ?? [];
        if (linked.length === 0) return;
        setKnownAddresses((prev) => {
          const merged = [...new Set([...prev, ...linked])];
          if (merged.length === prev.length && merged.every((a, i) => a === prev[i])) return prev;
          saveKnownAddresses(merged);
          return merged;
        });
      })
      .catch(() => {});
  }, [wallet]);

  const switchTo = useCallback((targetAddress: string): boolean => {
    const sessions = loadSessions();
    const session = sessions[targetAddress];
    if (!session) return false;
    if (new Date(session.expiresAt) <= new Date()) {
      // Session expired — clean it up
      const { [targetAddress]: _, ...rest } = sessions;
      saveSessions(rest);
      return false;
    }
    setWallet(session);
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    return true;
  }, []);

  const disconnect = useCallback(() => {
    setWallet(null);
    sessionStorage.removeItem(STORAGE_KEY);
    // Known addresses intentionally kept so user can reconnect quickly
  }, []);

  const removeKnownAddress = useCallback((address: string) => {
    // Also clear any stored session for this address
    const sessions = loadSessions();
    const { [address]: _, ...rest } = sessions;
    saveSessions(rest);

    setKnownAddresses((prev) => {
      const updated = prev.filter((a) => a !== address);
      saveKnownAddresses(updated);
      return updated;
    });
  }, []);

  return (
    <WalletContext.Provider
      value={{
        address: wallet?.address ?? null,
        token: wallet?.token ?? null,
        isConnected: !!wallet,
        knownAddresses,
        switchableAddresses: Object.entries(loadSessions())
          .filter(([addr, s]) => addr !== wallet?.address && new Date(s.expiresAt) > new Date())
          .map(([addr]) => addr),
        connect,
        switchTo,
        disconnect,
        removeKnownAddress,
        openConnectModal,
      }}
    >
      {children}
      {connectModalOpen && (
        <ConnectWalletModal
          onClose={() => { setConnectModalOpen(false); setConnectModalPrefill(undefined); }}
          prefillAddress={connectModalPrefill}
        />
      )}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  return useContext(WalletContext);
}
