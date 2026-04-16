import { api } from '@/lib/api';
import { formatDate } from '@/lib/format';
import { IpfsImage } from '@/components/ui/IpfsImage';
import { ArrowRight, BarChart3, Gift } from 'lucide-react';

interface HistoryItem {
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
}

export default async function AssetHistoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ name: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { name } = await params;
  const assetName = decodeURIComponent(name);
  const sp = await searchParams;
  const page = Number(sp.page ?? 1);

  const [historyResult, stats, asset] = await Promise.all([
    api.getAssetHistory(assetName, page).catch(() => ({ data: [] as HistoryItem[], total: 0, page: 1, pageSize: 20 })),
    api.getMarketplaceStats(assetName).catch(() => null),
    api.getAsset(assetName).catch(() => null),
  ]);

  const entries = historyResult.data as HistoryItem[];
  const total = historyResult.total;
  const pageSize = 20;
  const totalPages = Math.ceil(total / pageSize);
  const assetData = asset as { name: string; ipfsHash?: string; hasIpfs?: boolean; amount?: number } | null;

  const short = (addr: string) => `${addr.slice(0, 8)}…${addr.slice(-6)}`;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        {assetData?.hasIpfs && assetData?.ipfsHash && (
          <div className="w-16 h-16 rounded-xl overflow-hidden bg-gray-800 shrink-0">
            <IpfsImage hash={assetData.ipfsHash} alt={assetName} className="w-full h-full object-cover" />
          </div>
        )}
        <div>
          <h1 className="text-3xl font-bold">{assetName}</h1>
          <p className="text-gray-400 mt-1">Trade History</p>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="card p-4 text-center">
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Total Sales</p>
            <p className="text-2xl font-bold text-white">{stats.totalSales}</p>
          </div>
          <div className="card p-4 text-center">
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Volume</p>
            <p className="text-2xl font-bold text-avian-400">
              {stats.volume > 0 ? (
                <>{stats.volume.toLocaleString()} <span className="text-sm font-normal text-gray-400">AVN</span></>
              ) : (
                <span className="text-gray-500 text-base">—</span>
              )}
            </p>
          </div>
          <div className="card p-4 text-center">
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Floor Price</p>
            <p className="text-2xl font-bold text-avian-400">
              {stats.floorPrice != null ? (
                <>{stats.floorPrice} <span className="text-sm font-normal text-gray-400">AVN</span></>
              ) : (
                <span className="text-gray-500 text-base">—</span>
              )}
            </p>
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

      {/* Links */}
      <div className="flex gap-3">
        <a
          href={`/marketplace?asset=${encodeURIComponent(assetName)}`}
          className="btn-secondary text-sm"
        >
          View Active Listings
        </a>
        <a
          href={`/assets?filter=${encodeURIComponent(assetName)}`}
          className="btn-secondary text-sm"
        >
          Asset Details
        </a>
      </div>

      {/* History table */}
      {entries.length === 0 ? (
        <div className="card text-center py-16 space-y-4">
          <BarChart3 className="w-12 h-12 text-gray-500 mx-auto" />
          <p className="text-gray-300 font-semibold text-lg">No activity recorded yet</p>
          <p className="text-gray-500 text-sm">
            Completed trades and gifts for <span className="text-avian-400">{assetName}</span> will appear here.
          </p>
        </div>
      ) : (
        <div className="card overflow-hidden p-0">
          {/* Desktop table */}
          <div className="hidden sm:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-500 uppercase tracking-wide border-b border-gray-800">
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Price</th>
                  <th className="px-4 py-3">Qty</th>
                  <th className="px-4 py-3">From</th>
                  <th className="px-4 py-3"></th>
                  <th className="px-4 py-3">To</th>
                  <th className="px-4 py-3">Tx</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {entries.map((entry) => (
                  <tr key={entry.id} className="hover:bg-gray-800/50 transition-colors">
                    <td className="px-4 py-3 text-gray-300 whitespace-nowrap">
                      {formatDate(entry.date)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {entry.type === 'gift' ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-pink-500/10 text-pink-400 ring-1 ring-pink-500/20">
                          <Gift className="w-3 h-3" /> Gift
                        </span>
                      ) : (
                        <span className="inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 ring-1 ring-blue-500/20">
                          Sale
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-semibold text-avian-400 whitespace-nowrap">
                      {entry.priceAvn != null ? (
                        <>{Number(entry.priceAvn)} <span className="text-gray-500 font-normal">AVN</span></>
                      ) : (
                        <span className="text-pink-400 font-normal text-xs">Gift</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-300">{Number(entry.assetAmount)}</td>
                    <td className="px-4 py-3 text-gray-400 font-mono text-xs">{short(entry.sellerAddress)}</td>
                    <td className="px-4 py-3">
                      <ArrowRight className="w-3 h-3 text-gray-600" />
                    </td>
                    <td className="px-4 py-3 text-gray-400 font-mono text-xs">
                      {entry.buyerAddress ? short(entry.buyerAddress) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      {entry.txid ? (
                        <span className="font-mono text-xs text-blue-400" title={entry.txid}>
                          {entry.txid.slice(0, 8)}…
                        </span>
                      ) : (
                        <span className="text-gray-600">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="sm:hidden divide-y divide-gray-800">
            {entries.map((entry) => (
              <div key={entry.id} className="p-4 space-y-2">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">{formatDate(entry.date)}</span>
                    {entry.type === 'gift' ? (
                      <span className="inline-flex items-center gap-1 text-xs font-medium px-1.5 py-0.5 rounded-full bg-pink-500/10 text-pink-400 ring-1 ring-pink-500/20">
                        <Gift className="w-3 h-3" /> Gift
                      </span>
                    ) : (
                      <span className="inline-flex items-center text-xs font-medium px-1.5 py-0.5 rounded-full bg-blue-500/10 text-blue-400 ring-1 ring-blue-500/20">
                        Sale
                      </span>
                    )}
                  </div>
                  <span className="font-semibold text-avian-400">
                    {entry.priceAvn != null ? `${Number(entry.priceAvn)} AVN` : <span className="text-pink-400 font-normal text-xs">Gift</span>}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-400">
                  <span className="font-mono">{short(entry.sellerAddress)}</span>
                  <ArrowRight className="w-3 h-3 text-gray-600 shrink-0" />
                  <span className="font-mono">
                    {entry.buyerAddress ? short(entry.buyerAddress) : '—'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-4">
          {page > 1 && (
            <a
              href={`/assets/${encodeURIComponent(assetName)}/history?page=${page - 1}`}
              className="btn-secondary text-sm"
            >
              ← Prev
            </a>
          )}
          <span className="text-sm text-gray-500">
            Page {page} of {totalPages}
          </span>
          {page < totalPages && (
            <a
              href={`/assets/${encodeURIComponent(assetName)}/history?page=${page + 1}`}
              className="btn-secondary text-sm"
            >
              Next →
            </a>
          )}
        </div>
      )}
    </div>
  );
}
