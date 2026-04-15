'use client';

import { useEffect, useState } from 'react';
import { useWallet } from '@/context/WalletContext';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/format';
import Link from 'next/link';

type OfferStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'WITHDRAWN' | 'COMPLETED' | 'CANCELLED';

interface MyOffer {
  id: string;
  offeredPriceAvn: number;
  status: OfferStatus;
  createdAt: string;
  listing: {
    id: string;
    assetName: string;
    assetAmount: number;
    priceAvn: number;
    status: string;
    sellerAddress: string;
  };
}

const STATUS_LABEL: Record<OfferStatus, { label: string; className: string }> = {
  PENDING: { label: 'Pending', className: 'bg-yellow-900/40 text-yellow-300' },
  ACCEPTED: { label: 'Accepted — Action required', className: 'bg-green-900/40 text-green-300 font-semibold' },
  REJECTED: { label: 'Rejected', className: 'bg-red-900/40 text-red-400' },
  WITHDRAWN: { label: 'Withdrawn', className: 'bg-gray-700/40 text-gray-400' },
  COMPLETED: { label: 'Completed', className: 'bg-blue-900/40 text-blue-300' },
  CANCELLED: { label: 'Cancelled', className: 'bg-gray-700/40 text-gray-400' },
};

export default function MyOffersPage() {
  const { address, token } = useWallet();
  const [offers, setOffers] = useState<MyOffer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }
    api
      .getMyOffers(token)
      .then((data) => setOffers(data as MyOffer[]))
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [token]);

  async function handleCancel(offerId: string) {
    if (!token) return;
    setCancellingId(offerId);
    try {
      await api.cancelOffer(offerId, token);
      setOffers((prev) =>
        prev.map((o) => (o.id === offerId ? { ...o, status: 'CANCELLED' as const } : o))
      );
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to cancel offer.');
    } finally {
      setCancellingId(null);
    }
  }

  if (!address) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center text-gray-400">
        Connect your wallet to view your offers.
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 py-10 px-4">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold text-white mb-6">My Offers</h1>

        {loading && <p className="text-gray-400">Loading…</p>}
        {error && <p className="text-red-400">{error}</p>}

        {!loading && offers.length === 0 && (
          <p className="text-gray-500">You haven't made any offers yet.</p>
        )}

        <div className="space-y-4">
          {offers.map((offer) => {
            const { label, className } = STATUS_LABEL[offer.status] ?? {
              label: offer.status,
              className: 'bg-gray-700 text-gray-300',
            };

            return (
              <div key={offer.id} className="bg-gray-900 rounded-xl border border-gray-800 p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-lg font-semibold text-white">{offer.listing.assetName}</p>
                    <p className="text-sm text-gray-400 mt-0.5">
                      Your offer: <span className="text-white font-medium">{offer.offeredPriceAvn} AVN</span>
                      {' · '}
                      Ask: {offer.listing.priceAvn} AVN
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {formatDate(offer.createdAt)}
                    </p>
                  </div>
                  <span className={`text-xs px-2.5 py-1 rounded-full ${className}`}>{label}</span>
                </div>

                {offer.status === 'ACCEPTED' && (
                  <div className="mt-4 pt-4 border-t border-gray-800">
                    <p className="text-sm text-green-400 mb-3">
                      The seller accepted your offer. Complete the purchase now.
                    </p>
                    <div className="flex gap-3">
                      <Link
                        href={`/listings/${offer.listing.id}`}
                        className="inline-block bg-avian-500 hover:bg-avian-600 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
                      >
                        Complete Purchase →
                      </Link>
                      <button
                        onClick={() => handleCancel(offer.id)}
                        disabled={cancellingId === offer.id}
                        className="text-sm px-4 py-2 rounded-lg border border-gray-600 text-red-400 hover:bg-gray-800 transition-colors disabled:opacity-50"
                      >
                        {cancellingId === offer.id ? 'Cancelling…' : 'Cancel Offer'}
                      </button>
                    </div>
                  </div>
                )}

                {offer.status === 'COMPLETED' && (
                  <div className="mt-3 pt-3 border-t border-gray-800">
                    <Link
                      href={`/listings/${offer.listing.id}`}
                      className="text-sm text-blue-400 hover:underline"
                    >
                      View listing →
                    </Link>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
