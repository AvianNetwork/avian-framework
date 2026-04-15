'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Clock } from 'lucide-react';
import { useWallet } from '../../../context/WalletContext';
import { api } from '../../../lib/api';
import { formatDate, formatDateShort } from '../../../lib/format';
import { CompletePurchase } from './CompletePurchase';
import { IpfsImage } from '../../../components/ui/IpfsImage';
import { useListingEvents } from '../../../hooks/useListingEvents';

const API_BASE = process.env['NEXT_PUBLIC_API_URL']?.replace('/api/v1', '') ?? 'http://localhost:4000';
import type { ListingData, OfferData } from './page';

export function ListingDetail({
  listing,
  offers,
}: {
  listing: ListingData;
  offers: OfferData[];
}) {
  const router = useRouter();
  const { address, token, isConnected, openConnectModal } = useWallet();
  const isSeller = address?.trim() === listing.sellerAddress?.trim();
  const isActive = listing.status === 'ACTIVE';

  // Find the buyer's own accepted offer (if any)
  const myAcceptedOffer = !isSeller
    ? offers.find((o) => o.buyerAddress?.trim() === address?.trim() && o.status === 'ACCEPTED')
    : undefined;

  const [offerPrice, setOfferPrice] = useState(listing.priceAvn.toString());
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showCancelOfferModal, setShowCancelOfferModal] = useState(false);
  const [ipfsHash, setIpfsHash] = useState<string | null>(null);
  const [holderMeta, setHolderMeta] = useState<{
    title?: string | null;
    description?: string | null;
    traits?: { trait_type: string; value: string | number }[] | null;
  } | null>(null);

  useEffect(() => setMounted(true), []);

  // Fetch IPFS hash for the asset image
  useEffect(() => {
    api.getAsset(listing.assetName).then((a) => {
      const asset = a as { hasIpfs?: boolean; ipfsHash?: string };
      if (asset.hasIpfs && asset.ipfsHash) setIpfsHash(asset.ipfsHash);
    }).catch(() => {});
  }, [listing.assetName]);

  // Fetch seller's holder metadata for this asset
  useEffect(() => {
    api.getHolderMetadata(listing.assetName, listing.sellerAddress)
      .then((m) => {
        const meta = m as { title?: string | null; description?: string | null; traits?: { trait_type: string; value: string | number }[] | null };
        if (meta?.title || meta?.description || meta?.traits?.length) setHolderMeta(meta);
      })
      .catch(() => {});
  }, [listing.assetName, listing.sellerAddress]);

  // Subscribe to real-time listing updates
  const handleLiveUpdate = useCallback(() => {
    router.refresh();
  }, [router]);
  useListingEvents(listing.id, handleLiveUpdate);

  async function handleMakeOffer() {
    setError('');
    setSuccess('');
    if (!isConnected) { setError('Connect your wallet to make an offer.'); return; }
    if (!offerPrice || Number(offerPrice) <= 0) { setError('Enter a valid offer price.'); return; }
    setLoading(true);
    try {
      await api.createOffer(
        { listingId: listing.id, offeredPriceAvn: Number(offerPrice) },
        token!
      );
      setSuccess('Offer submitted! The seller will be notified.');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to submit offer.');
    } finally {
      setLoading(false);
    }
  }

  async function handleOfferAction(
    offerId: string,
    action: 'accept' | 'reject'
  ) {
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      if (action === 'accept') await api.acceptOffer(offerId, token!);
      else await api.rejectOffer(offerId, token!);
      setSuccess(`Offer ${action}ed.`);
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : `Failed to ${action} offer.`);
    } finally {
      setLoading(false);
    }
  }

  async function handleCancel() {
    setLoading(true);
    setShowCancelModal(false);
    try {
      await api.cancelListing(listing.id, token!);
      setSuccess('Listing cancelled.');
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to cancel listing.');
    } finally {
      setLoading(false);
    }
  }

  async function handleCancelOffer() {
    const acceptedOffer = offers.find((o) => o.status === 'ACCEPTED');
    if (!acceptedOffer) return;
    setLoading(true);
    setShowCancelOfferModal(false);
    try {
      await api.cancelOffer(acceptedOffer.id, token!);
      setSuccess('Offer cancelled. The listing is active again.');
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to cancel offer.');
    } finally {
      setLoading(false);
    }
  }

  const statusBadge: Record<string, string> = {
    ACTIVE: 'badge-active',
    SOLD: 'badge-sold',
    CANCELLED: 'badge-cancelled',
    EXPIRED: 'badge-expired',
    PENDING: 'badge',
    ACCEPTED: 'badge-active',
    REJECTED: 'badge-cancelled',
    WITHDRAWN: 'badge-cancelled',
    COMPLETED: 'badge-sold',
  };

  // Offers the seller sees in their management section
  const acceptedOffer = offers.find((o) => o.status === 'ACCEPTED');

  const pendingOffers = offers.filter((o) => o.status === 'PENDING');

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <a href="/marketplace" className="hover:text-white transition-colors">Marketplace</a>
        <span>›</span>
        <span className="text-gray-300">{listing.assetName}</span>
      </div>

      {/* Main card */}
      <div className="card space-y-6">
        {/* Asset image banner */}
        {ipfsHash && (
          <div className="-mx-6 -mt-6 rounded-t-2xl overflow-hidden h-72 bg-gray-950">
            <IpfsImage
              hash={ipfsHash}
              alt={listing.assetName}
              contain
              expandable
              className="w-full h-full"
            />
          </div>
        )}

        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold">{holderMeta?.title || listing.assetName}</h1>
            {holderMeta?.title && (
              <p className="text-sm text-gray-500 mt-0.5">{listing.assetName}</p>
            )}
            {holderMeta?.description ? (
              <p className="text-gray-400 mt-2 text-sm leading-relaxed">{holderMeta.description}</p>
            ) : null}
            <p className={holderMeta?.description ? 'text-gray-500 text-xs mt-1' : 'text-gray-400 mt-1'}>
              {listing.assetAmount} units available
            </p>
          </div>
          <span className={statusBadge[listing.status] ?? 'badge'}>{listing.status}</span>
        </div>

        <div className="border-t border-gray-800 pt-5 grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-gray-500 uppercase tracking-wide text-xs mb-1">Price</p>
            <p className="text-3xl font-bold text-avian-400">
              {listing.priceAvn} <span className="text-base font-normal text-gray-400">AVN</span>
            </p>
          </div>
          <div>
            <p className="text-gray-500 uppercase tracking-wide text-xs mb-1">Seller</p>
            {listing.sellerProfile?.username ? (
              <a
                href={`/users/${listing.sellerProfile.username}`}
                className="flex items-center gap-2 mt-1 group w-fit"
              >
                <div className="w-6 h-6 rounded-full overflow-hidden bg-gray-700 shrink-0">
                  {listing.sellerProfile.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={`${API_BASE}${listing.sellerProfile.avatarUrl}`}
                      alt={listing.sellerProfile.username}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="w-full h-full flex items-center justify-center text-xs font-bold text-gray-400">
                      {listing.sellerProfile.username.charAt(0).toUpperCase()}
                    </span>
                  )}
                </div>
                <span className="text-avian-400 group-hover:text-avian-300 transition-colors text-sm">
                  {listing.sellerProfile.displayName ?? `@${listing.sellerProfile.username}`}
                </span>
              </a>
            ) : (
              <code className="text-gray-300 text-xs break-all">{listing.sellerAddress}</code>
            )}
          </div>
          {listing.expiresAt && (
            <div>
              <p className="text-gray-500 uppercase tracking-wide text-xs mb-1">Expires</p>
              <p className="text-gray-300">{formatDate(listing.expiresAt)}</p>
            </div>
          )}
          <div>
            <p className="text-gray-500 uppercase tracking-wide text-xs mb-1">Listed</p>
            <p className="text-gray-300">{formatDateShort(listing.createdAt)}</p>
          </div>
        </div>

        {/* Traits / Properties */}
        {holderMeta?.traits && holderMeta.traits.length > 0 && (
          <div className="border-t border-gray-800 pt-5">
            <p className="text-gray-500 uppercase tracking-wide text-xs mb-3">Properties</p>
            <div className="flex flex-wrap gap-2">
              {holderMeta.traits.map((t, i) => (
                <div
                  key={i}
                  className="flex flex-col items-center rounded-lg border border-avian-700/40 bg-avian-950/30 px-3 py-2 text-center min-w-[80px]"
                >
                  <span className="text-avian-400 text-[10px] uppercase tracking-wider font-medium leading-none mb-1">
                    {t.trait_type}
                  </span>
                  <span className="text-white text-sm font-semibold leading-none">{t.value}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {error && <p className="text-red-400 text-sm bg-red-900/20 rounded-lg px-3 py-2">{error}</p>}
        {success && <p className="text-green-400 text-sm bg-green-900/20 rounded-lg px-3 py-2">{success}</p>}

        {/* Seller actions */}
        {mounted && isSeller && isActive && (
          <button onClick={() => setShowCancelModal(true)} disabled={loading} className="btn-secondary text-red-400 hover:text-red-300">
            Cancel Listing
          </button>
        )}

        {/* Seller: show waiting state when offer accepted */}
        {mounted && isSeller && listing.status === 'SOLD' && offers.some((o) => o.status === 'ACCEPTED') && (
          <div className="bg-yellow-900/20 border border-yellow-700/40 rounded-lg px-4 py-3 text-sm text-yellow-300 space-y-3">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 shrink-0" /> Offer accepted — waiting for the buyer to complete the purchase.
            </div>
            <button
              onClick={() => setShowCancelOfferModal(true)}
              disabled={loading}
              className="text-sm px-4 py-2 rounded-lg border border-yellow-700/60 text-red-400 hover:bg-gray-800/60 transition-colors disabled:opacity-50"
            >
              Cancel Accepted Offer
            </button>
          </div>
        )}

        {/* Buyer: make offer */}
        {mounted && !isSeller && isActive && (
          <div className="border-t border-gray-800 pt-5 space-y-3">
            <h2 className="font-semibold">Make an Offer</h2>
            {isConnected ? (
              <div className="flex gap-3">
                <input
                  className="input flex-1"
                  type="number"
                  min="0"
                  step="any"
                  value={offerPrice}
                  onChange={(e) => setOfferPrice(e.target.value)}
                  placeholder="AVN amount"
                />
                <button onClick={handleMakeOffer} disabled={loading} className="btn-primary shrink-0">
                  {loading ? 'Submitting…' : 'Submit Offer'}
                </button>
              </div>
            ) : (
              <p className="text-sm text-gray-400">
                <button onClick={() => openConnectModal()} className="text-avian-400 hover:underline">Connect your wallet</button> to make an offer.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Offers (seller sees all, others see count) */}
      {mounted && isSeller && offers.length > 0 && (
        <div className="card space-y-4">
          <h2 className="font-semibold text-lg">
            Offers ({pendingOffers.length} pending)
          </h2>
          <div className="space-y-3">
            {offers.map((offer) => (
              <div
                key={offer.id}
                className="flex items-center justify-between bg-gray-800 rounded-lg px-4 py-3"
              >
                <div>
                  <p className="text-sm font-medium text-avian-400">
                    {offer.offeredPriceAvn} AVN
                  </p>
                  <code className="text-xs text-gray-500 break-all">{offer.buyerAddress}</code>
                </div>
                <div className="flex items-center gap-2">
                  {offer.status === 'PENDING' ? (
                    <>
                      <button
                        onClick={() => handleOfferAction(offer.id, 'accept')}
                        disabled={loading}
                        className="btn-primary text-xs px-3 py-1"
                      >
                        Accept
                      </button>
                      <button
                        onClick={() => handleOfferAction(offer.id, 'reject')}
                        disabled={loading}
                        className="btn-secondary text-xs px-3 py-1 text-red-400"
                      >
                        Reject
                      </button>
                    </>
                  ) : offer.status === 'ACCEPTED' ? (
                    <>
                      <span className={statusBadge[offer.status] ?? 'badge'}>{offer.status}</span>
                      <button
                        onClick={() => setShowCancelOfferModal(true)}
                        disabled={loading}
                        className="text-xs px-3 py-1 rounded-lg border border-gray-600 text-red-400 hover:bg-gray-800 transition-colors disabled:opacity-50"
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <span className={statusBadge[offer.status] ?? 'badge'}>{offer.status}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {mounted && !isSeller && pendingOffers.length > 0 && (
        <div className="card">
          <p className="text-sm text-gray-400">{pendingOffers.length} pending offer(s) on this listing.</p>
        </div>
      )}

      {/* Buyer: complete an accepted offer */}
      {mounted && myAcceptedOffer && token && (
        <div className="space-y-3">
          <CompletePurchase
            offerId={myAcceptedOffer.id}
            token={token}
          />
          <button
            onClick={() => setShowCancelOfferModal(true)}
            disabled={loading}
            className="text-sm px-4 py-2 rounded-lg border border-gray-600 text-red-400 hover:bg-gray-800 transition-colors disabled:opacity-50"
          >
            Cancel Offer
          </button>
        </div>
      )}
      {showCancelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl p-6 w-full max-w-sm space-y-4">
            <h2 className="text-lg font-semibold text-white">Cancel listing?</h2>
            <p className="text-sm text-gray-400">This will cancel your listing for <span className="font-medium text-white">{listing.assetName}</span>. This action cannot be undone.</p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowCancelModal(false)}
                className="px-4 py-2 text-sm rounded-lg border border-gray-600 text-gray-300 hover:bg-gray-800 transition-colors"
              >
                Keep Listing
              </button>
              <button
                onClick={handleCancel}
                className="px-4 py-2 text-sm rounded-lg bg-red-600 hover:bg-red-700 text-white font-medium transition-colors"
              >
                Cancel Listing
              </button>
            </div>
          </div>
        </div>
      )}
      {showCancelOfferModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl p-6 w-full max-w-sm space-y-4">
            <h2 className="text-lg font-semibold text-white">Cancel accepted offer?</h2>
            <p className="text-sm text-gray-400">This will cancel the accepted offer and return the listing for <span className="font-medium text-white">{listing.assetName}</span> to active status.</p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowCancelOfferModal(false)}
                className="px-4 py-2 text-sm rounded-lg border border-gray-600 text-gray-300 hover:bg-gray-800 transition-colors"
              >
                Keep Offer
              </button>
              <button
                onClick={handleCancelOffer}
                className="px-4 py-2 text-sm rounded-lg bg-red-600 hover:bg-red-700 text-white font-medium transition-colors"
              >
                Cancel Offer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
