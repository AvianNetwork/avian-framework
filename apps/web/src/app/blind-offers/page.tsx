'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useWallet } from '@/context/WalletContext';
import { api } from '@/lib/api';
import { IpfsImage } from '@/components/ui/IpfsImage';
import { formatDate } from '@/lib/format';
import { getSocket } from '@/lib/socket';

type BlindOfferStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'WITHDRAWN' | 'COMPLETED' | 'EXPIRED';

interface MyBlindOffer {
  id: string;
  assetName: string;
  assetAmount: number | string;
  offeredPriceAvn: number | string;
  status: BlindOfferStatus;
  createdAt: string;
  listingId?: string;
  offerId?: string;
}

const STATUS_LABEL: Record<BlindOfferStatus, { label: string; className: string }> = {
  PENDING: { label: 'Pending', className: 'bg-yellow-900/40 text-yellow-300' },
  ACCEPTED: { label: 'Accepted — Action required', className: 'bg-green-900/40 text-green-300 font-semibold' },
  REJECTED: { label: 'Rejected', className: 'bg-red-900/40 text-red-400' },
  WITHDRAWN: { label: 'Withdrawn', className: 'bg-gray-700/40 text-gray-400' },
  COMPLETED: { label: 'Completed', className: 'bg-blue-900/40 text-blue-300' },
  EXPIRED: { label: 'Expired', className: 'bg-gray-700/40 text-gray-500' },
};

export default function MyBlindOffersPage() {
  const { address, token } = useWallet();
  const [offers, setOffers] = useState<MyBlindOffer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [withdrawingId, setWithdrawingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [ipfsHashes, setIpfsHashes] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }
    api
      .getMyBlindOffers(token)
      .then(async (data) => {
        const list = data as MyBlindOffer[];
        setOffers(list);
        // Fetch IPFS hashes for each unique asset
        const unique = [...new Set(list.map((o) => o.assetName))];
        const entries = await Promise.all(
          unique.map(async (name) => {
            try {
              const asset = await api.getAsset(name) as { ipfsHash?: string };
              return [name, asset.ipfsHash ?? ''] as const;
            } catch {
              return [name, ''] as const;
            }
          })
        );
        setIpfsHashes(Object.fromEntries(entries));
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [token]);

  // Real-time status updates via WebSocket notifications
  useEffect(() => {
    if (!address) return;
    let alive = true;
    let offFn: (() => void) | null = null;

    getSocket().then((s) => {
      if (!alive) return;
      const subscribe = () => s.emit('subscribe:address', address);
      subscribe();
      s.on('connect', subscribe);

      const handler = (n: { type: string; link?: string }) => {
        if (!alive) return;
        // Extract offer ID from notification link e.g. /blind-offers?id=xxx
        const id = n.link ? new URL(n.link, 'http://x').searchParams.get('id') : null;
        if (!id) return;
        if (n.type === 'blind_offer_rejected') {
          setOffers((prev) => prev.map((o) => o.id === id ? { ...o, status: 'REJECTED' } : o));
        } else if (n.type === 'blind_offer_accepted') {
          setOffers((prev) => prev.map((o) => o.id === id ? { ...o, status: 'ACCEPTED' } : o));
        }
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

  async function handleWithdraw(id: string) {
    if (!token) return;
    setWithdrawingId(id);
    try {
      await api.withdrawBlindOffer(id, token);
      setOffers((prev) =>
        prev.map((o) => (o.id === id ? { ...o, status: 'WITHDRAWN' } : o))
      );
    } catch (e: unknown) {
      alert((e as Error).message ?? 'Failed to withdraw');
    } finally {
      setWithdrawingId(null);
    }
  }

  async function handleDelete(id: string) {
    if (!token) return;
    setDeletingId(id);
    try {
      await api.deleteBlindOffer(id, token);
      setOffers((prev) => prev.filter((o) => o.id !== id));
    } catch (e: unknown) {
      alert((e as Error).message ?? 'Failed to remove offer');
    } finally {
      setDeletingId(null);
    }
  }

  if (!address) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center text-gray-400">
        Connect your wallet to view your blind offers.
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 py-10 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-white">My Blind Offers</h1>
          <Link
            href="/blind-offers/create"
            className="bg-avian-500 hover:bg-avian-600 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
          >
            + New Blind Offer
          </Link>
        </div>

        {loading && <p className="text-gray-400">Loading…</p>}
        {error && <p className="text-red-400">{error}</p>}

        {!loading && offers.length === 0 && (
          <div className="text-center py-16 text-gray-500">
            <p className="mb-4">You haven't submitted any blind offers yet.</p>
            <p className="text-sm text-gray-600">
              A blind offer lets you bid on an asset without an active listing. The asset holder
              can accept your offer and complete the sale.
            </p>
          </div>
        )}

        <div className="space-y-4">
          {offers.map((offer) => {
            const { label, className } = STATUS_LABEL[offer.status] ?? {
              label: offer.status,
              className: 'bg-gray-700 text-gray-300',
            };

            return (
              <div key={offer.id} className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
                {/* Asset image strip */}
                {ipfsHashes[offer.assetName] && (
                  <div className="h-32 w-full overflow-hidden">
                    <IpfsImage
                      hash={ipfsHashes[offer.assetName]!}
                      alt={offer.assetName}
                      className="!aspect-auto h-32 w-full rounded-none"
                    />
                  </div>
                )}

                <div className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <Link
                      href={`/assets?filter=${encodeURIComponent(offer.assetName)}`}
                      className="text-lg font-semibold text-white hover:text-avian-400 transition-colors"
                    >
                      {offer.assetName}
                    </Link>
                    <p className="text-sm text-gray-400 mt-0.5">
                      Amount:{' '}
                      <span className="text-white font-medium">
                        {Number(offer.assetAmount).toLocaleString()}
                      </span>
                      {' · '}
                      Your offer:{' '}
                      <span className="text-white font-medium">
                        {Number(offer.offeredPriceAvn).toLocaleString()} AVN
                      </span>
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {formatDate(offer.createdAt)}
                    </p>
                  </div>
                  <span className={`text-xs px-2.5 py-1 rounded-full ${className}`}>{label}</span>
                </div>

                {offer.status === 'ACCEPTED' && offer.listingId && (
                  <div className="mt-4 pt-4 border-t border-gray-800">
                    <p className="text-sm text-green-400 mb-3">
                      The seller accepted your offer and provided a signed PSBT. Complete the
                      purchase now.
                    </p>
                    <Link
                      href={`/listings/${offer.listingId}`}
                      className="inline-block bg-avian-500 hover:bg-avian-600 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
                    >
                      Complete Purchase →
                    </Link>
                  </div>
                )}

                {offer.status === 'COMPLETED' && offer.listingId && (
                  <div className="mt-3 pt-3 border-t border-gray-800">
                    <Link
                      href={`/listings/${offer.listingId}`}
                      className="text-sm text-blue-400 hover:underline"
                    >
                      View listing →
                    </Link>
                  </div>
                )}

                {offer.status === 'PENDING' && (
                  <div className="mt-3 pt-3 border-t border-gray-800 flex justify-end">
                    <button
                      onClick={() => handleWithdraw(offer.id)}
                      disabled={withdrawingId === offer.id}
                      className="text-xs text-red-400 hover:text-red-300 transition-colors disabled:opacity-50"
                    >
                      {withdrawingId === offer.id ? 'Withdrawing…' : 'Withdraw offer'}
                    </button>
                  </div>
                )}

                {(['WITHDRAWN', 'REJECTED', 'EXPIRED', 'COMPLETED'] as BlindOfferStatus[]).includes(offer.status) && (
                  <div className="mt-3 pt-3 border-t border-gray-800 flex justify-end">
                    <button
                      onClick={() => handleDelete(offer.id)}
                      disabled={deletingId === offer.id}
                      className="text-xs text-gray-500 hover:text-red-400 transition-colors disabled:opacity-50"
                    >
                      {deletingId === offer.id ? 'Removing…' : 'Remove'}
                    </button>
                  </div>
                )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
