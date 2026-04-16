import { api } from '@/lib/api';
import { formatDate } from '@/lib/format';
import { IpfsImage } from '@/components/ui/IpfsImage';
import { ArrowRight, Activity, Gift } from 'lucide-react';

interface FeedItem {
  id: string;
  type: 'sale' | 'gift';
  assetName: string;
  assetAmount: number;
  priceAvn: number | null;
  sellerAddress: string;
  buyerAddress: string | null;
  txid: string | null;
  blockHeight: number | null;
  date: string;
  ipfsHash: string | null;
  hasIpfs: boolean;
}

export default async function ActivityPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const sp = await searchParams;
  const page = Number(sp.page ?? 1);

  const [feedResult, stats] = await Promise.all([
    api.getActivityFeed(page).catch(() => ({ data: [] as FeedItem[], total: 0, page: 1, pageSize: 30 })),
    api.getMarketplaceStats().catch(() => null),
  ]);

  const feed = feedResult.data as FeedItem[];
  const total = feedResult.total;
  const pageSize = 30;
  const totalPages = Math.ceil(total / pageSize);

  const short = (addr: string) => `${addr.slice(0, 8)}…${addr.slice(-6)}`;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Activity className="w-7 h-7 text-avian-400" />
        <div>
          <h1 className="text-3xl font-bold">Activity Feed</h1>
          <p className="text-gray-400 mt-1">Recent sales and gifts across the marketplace</p>
        </div>
      </div>

      {/* Stats bar */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="card p-4 text-center">
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Total Sales</p>
            <p className="text-2xl font-bold text-white">{stats.totalSales}</p>
          </div>
          <div className="card p-4 text-center">
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Total Volume</p>
            <p className="text-2xl font-bold text-avian-400">
              {stats.volume > 0 ? (
                <>{stats.volume.toLocaleString()} <span className="text-sm font-normal text-gray-400">AVN</span></>
              ) : (
                <span className="text-gray-500 text-base">—</span>
              )}
            </p>
          </div>
          <div className="card p-4 text-center">
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Active Listings</p>
            <p className="text-2xl font-bold text-white">{stats.activeListings}</p>
          </div>
          <div className="card p-4 text-center">
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Last Sale</p>
            <p className="text-2xl font-bold text-white">
              {stats.lastSale != null ? (
                <>{stats.lastSale} <span className="text-sm font-normal text-gray-400">AVN</span></>
              ) : (
                <span className="text-gray-500 text-base">—</span>
              )}
            </p>
          </div>
        </div>
      )}

      {/* Empty state */}
      {feed.length === 0 ? (
        <div className="card text-center py-16 space-y-4">
          <Activity className="w-12 h-12 text-gray-500 mx-auto" />
          <p className="text-gray-300 font-semibold text-lg">No activity yet</p>
          <p className="text-gray-500 text-sm">
            Completed marketplace sales will appear here in real time.
          </p>
          <a href="/marketplace" className="btn-primary inline-block mt-2">
            Browse Marketplace
          </a>
        </div>
      ) : (
        <div className="space-y-3">
          {feed.map((item) => {
            const isGift = item.type === 'gift';
            const Wrapper = isGift ? 'div' : 'a';
            const wrapperProps = isGift
              ? {}
              : { href: `/listings/${item.id}` };
            return (
              <Wrapper
                key={item.id}
                {...wrapperProps}
                className="card p-4 flex items-center gap-4 hover:border-avian-700 transition-colors"
              >
                {/* Asset image */}
                <div className="w-12 h-12 rounded-lg overflow-hidden bg-gray-800 shrink-0 flex items-center justify-center">
                  {item.hasIpfs && item.ipfsHash ? (
                    <IpfsImage hash={item.ipfsHash} alt={item.assetName} className="w-full h-full object-cover" />
                  ) : isGift ? (
                    <Gift className="w-6 h-6 text-pink-400" />
                  ) : null}
                </div>

                {/* Details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-white">{item.assetName}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      isGift
                        ? 'bg-pink-900/40 text-pink-300'
                        : 'bg-blue-900/40 text-blue-300'
                    }`}>
                      {isGift ? 'Gift' : 'Sale'}
                    </span>
                    {Number(item.assetAmount) > 1 && (
                      <span className="text-xs text-gray-500">×{Number(item.assetAmount)}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 mt-1 text-xs text-gray-400">
                    <span className="font-mono">{short(item.sellerAddress)}</span>
                    <ArrowRight className="w-3 h-3 text-gray-600 shrink-0" />
                    <span className="font-mono">
                      {item.buyerAddress ? short(item.buyerAddress) : '—'}
                    </span>
                  </div>
                </div>

                {/* Price & timestamp */}
                <div className="text-right shrink-0">
                  {isGift ? (
                    <p className="font-bold text-pink-400">Gift</p>
                  ) : (
                    <p className="font-bold text-avian-400">
                      {Number(item.priceAvn)} <span className="text-sm font-normal text-gray-400">AVN</span>
                    </p>
                  )}
                  <p className="text-xs text-gray-500 mt-0.5">{formatDate(item.date)}</p>
                </div>
              </Wrapper>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-4">
          {page > 1 && (
            <a href={`/activity?page=${page - 1}`} className="btn-secondary text-sm">
              ← Prev
            </a>
          )}
          <span className="text-sm text-gray-500">
            Page {page} of {totalPages}
          </span>
          {page < totalPages && (
            <a href={`/activity?page=${page + 1}`} className="btn-secondary text-sm">
              Next →
            </a>
          )}
        </div>
      )}
    </div>
  );
}
