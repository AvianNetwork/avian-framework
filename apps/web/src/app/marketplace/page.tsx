import type { Metadata } from 'next';
import { api } from '@/lib/api';
import { formatDateShort } from '@/lib/format';
import { IpfsImage } from '@/components/ui/IpfsImage';
import { MarketplaceFilters } from '@/components/marketplace/MarketplaceFilters';
import { Suspense } from 'react';
import { Search, Store } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Marketplace',
  description: 'Browse active asset listings on Avian Marketplace. Buy and sell Avian assets with non-custodial PSBT trades.',
};

type SearchParams = {
  asset?: string;
  page?: string;
  minPrice?: string;
  maxPrice?: string;
  sort?: string;
};

export default async function MarketplacePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const page = Number(params.page ?? 1);
  const minPrice = params.minPrice ? Number(params.minPrice) : undefined;
  const maxPrice = params.maxPrice ? Number(params.maxPrice) : undefined;

  const [{ data: listings, total }, stats] = await Promise.all([
    api.getListings({
      asset: params.asset,
      page,
      minPrice,
      maxPrice,
      sort: params.sort,
    }),
    api.getMarketplaceStats(params.asset).catch(() => null),
  ]);

  const hasActiveFilters =
    !!params.asset || !!params.minPrice || !!params.maxPrice || (!!params.sort && params.sort !== 'newest');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Marketplace</h1>
          {params.asset && (
            <p className="text-gray-400 mt-1">
              Showing results for <span className="text-avian-400 font-medium">{params.asset}</span>
            </p>
          )}
        </div>
        <a href="/listings/create" className="btn-primary">
          + List an Asset
        </a>
      </div>

      {/* Stats bar */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="card p-4 text-center">
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Active Listings</p>
            <p className="text-2xl font-bold text-white">{stats.activeListings}</p>
          </div>
          <div className="card p-4 text-center">
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Floor Price</p>
            <p className="text-2xl font-bold text-avian-400">
              {stats.floorPrice != null ? (
                <>
                  {stats.floorPrice} <span className="text-sm font-normal text-gray-400">AVN</span>
                </>
              ) : (
                <span className="text-gray-500 text-base">—</span>
              )}
            </p>
          </div>
          <div className="card p-4 text-center">
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Total Volume</p>
            <p className="text-2xl font-bold text-white">
              {stats.volume > 0 ? (
                <>
                  {stats.volume.toLocaleString()} <span className="text-sm font-normal text-gray-400">AVN</span>
                </>
              ) : (
                <span className="text-gray-500 text-base">—</span>
              )}
            </p>
          </div>
          <div className="card p-4 text-center">
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Last Sale</p>
            <p className="text-2xl font-bold text-white">
              {stats.lastSale != null ? (
                <>
                  {stats.lastSale} <span className="text-sm font-normal text-gray-400">AVN</span>
                </>
              ) : (
                <span className="text-gray-500 text-base">—</span>
              )}
            </p>
            {stats.lastSaleAt && (
              <p className="text-xs text-gray-500 mt-1">{formatDateShort(stats.lastSaleAt)}</p>
            )}
          </div>
        </div>
      )}

      {/* Filters */}
      <Suspense fallback={null}>
        <MarketplaceFilters />
      </Suspense>

      {/* Results count */}
      <p className="text-gray-400 text-sm">
        {total} active listing{total !== 1 ? 's' : ''}{hasActiveFilters ? ' matching your filters' : ''}
      </p>

      {/* Grid or empty state */}
      {listings.length === 0 ? (
        hasActiveFilters ? (
          <div className="card text-center py-16 space-y-4">
            <Search className="w-12 h-12 text-gray-500 mx-auto" />
            <p className="text-gray-300 font-semibold text-lg">No listings match your filters</p>
            <p className="text-gray-500 text-sm">Try adjusting the price range, asset name, or sort order.</p>
            <a href="/marketplace" className="btn-secondary inline-block mt-2">
              Clear filters
            </a>
          </div>
        ) : (
          <div className="card text-center py-16 space-y-4">
            <Store className="w-12 h-12 text-gray-500 mx-auto" />
            <p className="text-gray-300 font-semibold text-lg">No active listings yet</p>
            <p className="text-gray-500 text-sm">Be the first seller on the Avian marketplace.</p>
            <a href="/listings/create" className="btn-primary inline-block mt-2">
              + List an Asset
            </a>
          </div>
        )
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {(listings as ListingCard[]).map((listing) => (
              <a
                key={listing.id}
                href={`/listings/${listing.id}`}
                className="card hover:border-avian-700 transition-colors block overflow-hidden p-0"
              >
                {listing.asset?.hasIpfs && listing.asset?.ipfsHash && (
                  <div className="relative h-48 bg-gray-800">
                    <IpfsImage hash={listing.asset.ipfsHash} alt={listing.assetName} className="w-full h-full object-cover" />
                  </div>
                )}
                <div className="p-4 space-y-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <h2 className="font-semibold text-lg">{listing.assetName}</h2>
                      <p className="text-gray-400 text-sm">{listing.assetAmount} units</p>
                    </div>
                    <span className="badge-active">Active</span>
                  </div>
                  <div className="border-t border-gray-800 pt-4 flex items-end justify-between">
                    <div>
                      <p className="text-xs text-gray-500 uppercase tracking-wide">Price</p>
                      <p className="text-2xl font-bold text-avian-400">
                        {listing.priceAvn} <span className="text-sm font-normal text-gray-400">AVN</span>
                      </p>
                    </div>
                    <span className="text-xs text-gray-500">{formatDateShort(listing.createdAt)}</span>
                  </div>
                </div>
              </a>
            ))}
          </div>

          {/* Pagination */}
          {(page > 1 || total > listings.length) && (
            <div className="flex justify-center gap-3 pt-4">
              {page > 1 && (
                <a
                  href={`/marketplace?${new URLSearchParams({
                    ...(params.asset ? { asset: params.asset } : {}),
                    ...(params.sort ? { sort: params.sort } : {}),
                    ...(params.minPrice ? { minPrice: params.minPrice } : {}),
                    ...(params.maxPrice ? { maxPrice: params.maxPrice } : {}),
                    page: String(page - 1),
                  }).toString()}`}
                  className="btn-secondary text-sm"
                >
                  ← Previous
                </a>
              )}
              {total > page * 20 && (
                <a
                  href={`/marketplace?${new URLSearchParams({
                    ...(params.asset ? { asset: params.asset } : {}),
                    ...(params.sort ? { sort: params.sort } : {}),
                    ...(params.minPrice ? { minPrice: params.minPrice } : {}),
                    ...(params.maxPrice ? { maxPrice: params.maxPrice } : {}),
                    page: String(page + 1),
                  }).toString()}`}
                  className="btn-secondary text-sm"
                >
                  Next →
                </a>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

interface ListingCard {
  id: string;
  assetName: string;
  assetAmount: number;
  priceAvn: number;
  status: string;
  createdAt: string;
  asset?: { ipfsHash: string | null; hasIpfs: boolean } | null;
}

