'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useWallet } from '@/context/WalletContext';
import { api } from '@/lib/api';

export default function CreateBlindOfferPage() {
  return (
    <Suspense>
      <CreateBlindOfferForm />
    </Suspense>
  );
}

function CreateBlindOfferForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { address, token } = useWallet();

  const [assetName, setAssetName] = useState(searchParams.get('asset') ?? '');
  const [assetAmount, setAssetAmount] = useState('');
  const [offeredPriceAvn, setOfferedPriceAvn] = useState('');
  const [ttlSeconds, setTtlSeconds] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // If asset query param is provided, pre-fill and disable the field
  const assetFromQuery = searchParams.get('asset');

  useEffect(() => {
    if (assetFromQuery) setAssetName(assetFromQuery);
  }, [assetFromQuery]);

  if (!address) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center text-gray-400">
        Connect your wallet to submit a blind offer.
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;

    const amount = parseFloat(assetAmount);
    const price = parseFloat(offeredPriceAvn);
    const ttl = ttlSeconds ? parseInt(ttlSeconds, 10) : undefined;

    if (isNaN(amount) || amount <= 0) {
      setError('Asset amount must be a positive number.');
      return;
    }
    if (isNaN(price) || price <= 0) {
      setError('Offered price must be a positive number.');
      return;
    }
    if (ttl !== undefined && ttl < 60) {
      setError('TTL must be at least 60 seconds.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      await api.createBlindOffer(
        { assetName, assetAmount: amount, offeredPriceAvn: price, ttlSeconds: ttl },
        token
      );
      router.push('/blind-offers');
    } catch (e: unknown) {
      setError((e as Error).message ?? 'Failed to submit blind offer');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 py-10 px-4">
      <div className="max-w-lg mx-auto">
        <div className="mb-6">
          <Link href="/blind-offers" className="text-sm text-gray-400 hover:text-white transition-colors">
            ← Back to My Blind Offers
          </Link>
        </div>

        <h1 className="text-2xl font-bold text-white mb-2">Make a Blind Offer</h1>
        <p className="text-sm text-gray-400 mb-8">
          Bid on an asset directly — no active listing required. The asset holder will be notified
          and can accept your offer by providing a signed PSBT.
        </p>

        <form onSubmit={handleSubmit} className="bg-gray-900 rounded-xl border border-gray-800 p-6 space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Asset Name</label>
            <input
              type="text"
              value={assetName}
              onChange={(e) => setAssetName(e.target.value)}
              disabled={!!assetFromQuery}
              placeholder="e.g. MYTOKEN"
              required
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-avian-500 disabled:opacity-60"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Asset Amount</label>
            <input
              type="number"
              min="0"
              step="any"
              value={assetAmount}
              onChange={(e) => setAssetAmount(e.target.value)}
              placeholder="e.g. 100"
              required
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-avian-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Offered Price (AVN)</label>
            <input
              type="number"
              min="0"
              step="any"
              value={offeredPriceAvn}
              onChange={(e) => setOfferedPriceAvn(e.target.value)}
              placeholder="e.g. 500"
              required
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-avian-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Time to Live (seconds){' '}
              <span className="text-gray-500 font-normal">optional — minimum 60</span>
            </label>
            <input
              type="number"
              min="60"
              step="1"
              value={ttlSeconds}
              onChange={(e) => setTtlSeconds(e.target.value)}
              placeholder="e.g. 86400 (24 hours)"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-avian-500"
            />
          </div>

          {error && (
            <div className="bg-red-900/30 border border-red-800 rounded-lg px-4 py-3 text-sm text-red-400">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-avian-500 hover:bg-avian-600 disabled:opacity-50 text-white font-semibold py-2.5 rounded-lg transition-colors"
          >
            {submitting ? 'Submitting…' : 'Submit Blind Offer'}
          </button>
        </form>
      </div>
    </div>
  );
}
