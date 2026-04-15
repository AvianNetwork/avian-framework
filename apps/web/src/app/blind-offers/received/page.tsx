'use client';

import { useEffect, useState } from 'react';
import { useWallet } from '@/context/WalletContext';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/format';
import { CopyButton } from '@/components/ui/CopyButton';
import { Check } from 'lucide-react';

interface ReceivedBlindOffer {
  id: string;
  buyerAddress: string;
  assetName: string;
  assetAmount: number | string;
  offeredPriceAvn: number | string;
  status: string;
  createdAt: string;
}

export default function ReceivedBlindOffersPage() {
  const { address, token } = useWallet();
  const [offers, setOffers] = useState<ReceivedBlindOffer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Accept flow state
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [unsignedPsbt, setUnsignedPsbt] = useState<string | null>(null);
  const [buildingPsbt, setBuildingPsbt] = useState(false);
  const [psbtInput, setPsbtInput] = useState('');
  const [acceptError, setAcceptError] = useState<string | null>(null);
  const [accepting, setAccepting] = useState(false);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [successResult, setSuccessResult] = useState<{ listingId: string; offerId: string } | null>(null);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }
    api
      .getReceivedBlindOffers(token)
      .then((data) => setOffers(data as ReceivedBlindOffer[]))
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [token]);

  function short(addr: string) {
    return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
  }

  async function handleReject(id: string) {
    if (!token) return;
    setRejectingId(id);
    try {
      await api.rejectBlindOffer(id, token);
      setOffers((prev) => prev.filter((o) => o.id !== id));
    } catch (e: unknown) {
      alert((e as Error).message ?? 'Failed to reject');
    } finally {
      setRejectingId(null);
    }
  }

  async function startAccept(offer: ReceivedBlindOffer) {
    setAcceptingId(offer.id);
    setAcceptError(null);
    setUnsignedPsbt(null);
    setPsbtInput('');
    setBuildingPsbt(true);
    try {
      const result = await api.buildListingPsbt(
        {
          sellerAddress: address,
          assetName: offer.assetName,
          assetAmount: Number(offer.assetAmount),
          priceAvn: Number(offer.offeredPriceAvn),
        },
        token!,
      );
      setUnsignedPsbt(result.psbtBase64);
    } catch (e: unknown) {
      setAcceptError((e as Error).message ?? 'Failed to build PSBT. You may need to provide it manually.');
    } finally {
      setBuildingPsbt(false);
    }
  }

  async function handleAccept(id: string) {
    if (!token || !psbtInput.trim()) return;
    setAccepting(true);
    setAcceptError(null);
    try {
      const result = await api.acceptBlindOffer(id, psbtInput.trim(), token);
      setOffers((prev) => prev.filter((o) => o.id !== id));
      setAcceptingId(null);
      setPsbtInput('');
      setSuccessResult(result as { listingId: string; offerId: string });
    } catch (e: unknown) {
      setAcceptError((e as Error).message ?? 'Acceptance failed');
    } finally {
      setAccepting(false);
    }
  }

  if (!address) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center text-gray-400">
        Connect your wallet to view received blind offers.
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 py-10 px-4">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold text-white mb-2">Received Blind Offers</h1>
        <p className="text-sm text-gray-400 mb-8">
          Buyers have bid on assets you hold. Accept an offer by providing your signed PSBT — the
          sale completes through the standard purchase flow.
        </p>

        {loading && <p className="text-gray-400">Loading…</p>}
        {error && <p className="text-red-400">{error}</p>}

        {!loading && offers.length === 0 && (
          <p className="text-gray-500">No pending blind offers on your assets.</p>
        )}

        <div className="space-y-4">
          {offers.map((offer) => (
            <div key={offer.id} className="bg-gray-900 rounded-xl border border-gray-800 p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-lg font-semibold text-white">{offer.assetName}</p>
                  <p className="text-sm text-gray-400 mt-0.5">
                    Amount:{' '}
                    <span className="text-white font-medium">
                      {Number(offer.assetAmount).toLocaleString()}
                    </span>
                    {' · '}
                    Offered price:{' '}
                    <span className="text-avian-400 font-semibold">
                      {Number(offer.offeredPriceAvn).toLocaleString()} AVN
                    </span>
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    From: {short(offer.buyerAddress)}
                    {' · '}
                    {formatDate(offer.createdAt)}
                  </p>
                </div>
                <span className="text-xs px-2.5 py-1 rounded-full bg-yellow-900/40 text-yellow-300">
                  Pending
                </span>
              </div>

              {/* Accept / Reject actions */}
              {acceptingId === offer.id ? (
                <div className="mt-4 pt-4 border-t border-gray-800 space-y-3">
                  {buildingPsbt && (
                    <p className="text-sm text-gray-400">Building PSBT…</p>
                  )}

                  {unsignedPsbt && (
                    <>
                      <p className="text-sm text-gray-300">
                        Sign this PSBT in your Avian Core console, then paste the signed result below:
                      </p>
                      <div className="flex gap-2 items-start">
                        <code className="flex-1 bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-xs text-avian-400 break-all font-mono block max-h-40 overflow-y-auto select-all">
                          walletprocesspsbt &quot;{unsignedPsbt}&quot; true &quot;SINGLE|FORKID|ANYONECANPAY&quot;
                        </code>
                        <CopyButton
                          text={`walletprocesspsbt "${unsignedPsbt}" true "SINGLE|FORKID|ANYONECANPAY"`}
                          className="shrink-0 bg-gray-700 hover:bg-gray-600 text-gray-300 text-xs px-2 py-1.5 rounded-lg transition-colors"
                        />
                      </div>
                      <p className="text-xs text-gray-500">
                        Copy the <code className="text-gray-400">&quot;psbt&quot;</code> value from the result and paste it below.
                      </p>
                    </>
                  )}

                  {!unsignedPsbt && !buildingPsbt && (
                    <div className="space-y-2">
                      <p className="text-sm text-gray-300">
                        Could not auto-build the PSBT. Build it manually in Avian Core:
                      </p>
                      <pre className="bg-gray-950 border border-gray-700 rounded-lg p-3 text-xs text-gray-300 overflow-x-auto whitespace-pre-wrap">
{`# 1. Get your asset UTXO
listunspent 1 9999999 [] true {"assetName":"${offer.assetName}"}

# 2. Create PSBT (replace TXID / VOUT / YOUR_ADDRESS)
createpsbt '[{"txid":"TXID","vout":VOUT}]' '[{"YOUR_ADDRESS":${Number(offer.offeredPriceAvn)}},{"YOUR_ADDRESS":{"transfer":{"${offer.assetName}":${Number(offer.assetAmount)}}}}]'

# 3. Sign with SINGLE|FORKID|ANYONECANPAY
walletprocesspsbt "PSBT_FROM_STEP_2" true "SINGLE|FORKID|ANYONECANPAY"

# Paste the "psbt" value from the result below`}
                      </pre>
                    </div>
                  )}

                  <textarea
                    value={psbtInput}
                    onChange={(e) => setPsbtInput(e.target.value)}
                    placeholder="Paste your signed PSBT here…"
                    rows={4}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-avian-500 font-mono"
                  />
                  {acceptError && (
                    <p className="text-sm text-red-400">{acceptError}</p>
                  )}
                  <div className="flex gap-3">
                    <button
                      onClick={() => handleAccept(offer.id)}
                      disabled={accepting || !psbtInput.trim()}
                      className="flex-1 bg-avian-500 hover:bg-avian-600 disabled:opacity-50 text-white text-sm font-semibold py-2 rounded-lg transition-colors"
                    >
                      {accepting ? 'Accepting…' : 'Confirm & Accept'}
                    </button>
                    <button
                      onClick={() => { setAcceptingId(null); setPsbtInput(''); setAcceptError(null); setUnsignedPsbt(null); }}
                      className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="mt-3 pt-3 border-t border-gray-800 flex gap-3 justify-end">
                  <button
                    onClick={() => startAccept(offer)}
                    className="text-sm bg-avian-500 hover:bg-avian-600 text-white font-semibold px-4 py-1.5 rounded-lg transition-colors"
                  >
                    Accept
                  </button>
                  <button
                    onClick={() => handleReject(offer.id)}
                    disabled={rejectingId === offer.id}
                    className="text-sm text-red-400 hover:text-red-300 transition-colors disabled:opacity-50"
                  >
                    {rejectingId === offer.id ? 'Rejecting…' : 'Reject'}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Success modal */}
      {successResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl p-6 w-full max-w-md space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-avian-900/50 border border-avian-700 flex items-center justify-center">
                <Check className="w-5 h-5 text-avian-400" />
              </div>
              <h2 className="text-lg font-semibold text-white">Offer Accepted</h2>
            </div>
            <p className="text-sm text-gray-300">
              The buyer can now complete the purchase.
            </p>
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-3 space-y-1 text-xs font-mono">
              <p className="text-gray-400">
                Listing ID: <span className="text-gray-200">{successResult.listingId}</span>
              </p>
              <p className="text-gray-400">
                Offer ID: <span className="text-gray-200">{successResult.offerId}</span>
              </p>
            </div>
            <button
              onClick={() => setSuccessResult(null)}
              className="w-full bg-avian-500 hover:bg-avian-600 text-white text-sm font-semibold py-2.5 rounded-lg transition-colors"
            >
              OK
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
