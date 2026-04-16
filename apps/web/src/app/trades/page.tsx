'use client';

import { useEffect, useState } from 'react';
import { useWallet } from '@/context/WalletContext';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/format';
import { IpfsImage } from '@/components/ui/IpfsImage';
import Link from 'next/link';
import { ArrowDownLeft, ArrowUpRight, Gift, History } from 'lucide-react';

interface Sale {
  id: string;
  assetName: string;
  assetAmount: number;
  priceAvn: number;
  sellerAddress: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  role: 'bought' | 'sold';
  buyer: string | null;
  soldPrice: number;
  asset?: { ipfsHash?: string; hasIpfs?: boolean };
}

interface GiftEntry {
  id: string;
  assetName: string;
  assetAmount: number;
  senderAddress: string;
  recipientAddress: string;
  txid: string;
  feeAvn: number;
  createdAt: string;
  role: 'sent' | 'received';
}

type Tab = 'all' | 'sales' | 'gifts';

export default function TradesPage() {
  const { address, token } = useWallet();
  const [sales, setSales] = useState<Sale[]>([]);
  const [gifts, setGifts] = useState<GiftEntry[]>([]);
  const [totalSales, setTotalSales] = useState(0);
  const [totalGifts, setTotalGifts] = useState(0);
  const [page, setPage] = useState(1);
  const [tab, setTab] = useState<Tab>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const pageSize = 20;

  useEffect(() => {
    if (!address) {
      setLoading(false);
      return;
    }
    setLoading(true);
    Promise.all([
      api.getSaleHistory(address, page).catch(() => ({ data: [] as unknown[], total: 0 })),
      api.getGiftHistory(address, page).catch(() => ({ data: [] as unknown[], total: 0 })),
    ])
      .then(([salesRes, giftsRes]) => {
        setSales(salesRes.data as Sale[]);
        setTotalSales(salesRes.total);
        setGifts(giftsRes.data as GiftEntry[]);
        setTotalGifts(giftsRes.total);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [address, page]);

  const short = (addr: string) => `${addr.slice(0, 8)}…${addr.slice(-6)}`;

  const filteredSales = tab === 'gifts' ? [] : sales;
  const filteredGifts = tab === 'sales' ? [] : gifts;
  const total = tab === 'sales' ? totalSales : tab === 'gifts' ? totalGifts : totalSales + totalGifts;
  const isEmpty = filteredSales.length === 0 && filteredGifts.length === 0;

  if (!address) {
    return (
      <div className="flex items-center justify-center py-20 text-gray-400">
        Connect your wallet to view your trade history.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <History className="w-7 h-7 text-avian-400" />
        <h1 className="text-3xl font-bold">Trade History</h1>
      </div>

      {/* Stats summary */}
      {!loading && (totalSales > 0 || totalGifts > 0) && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="card p-4 text-center">
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Total Trades</p>
            <p className="text-2xl font-bold text-white">{totalSales}</p>
          </div>
          <div className="card p-4 text-center">
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Bought</p>
            <p className="text-2xl font-bold text-green-400">
              {sales.filter((s) => s.role === 'bought').length}
            </p>
          </div>
          <div className="card p-4 text-center">
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Sold</p>
            <p className="text-2xl font-bold text-orange-400">
              {sales.filter((s) => s.role === 'sold').length}
            </p>
          </div>
          <div className="card p-4 text-center">
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Gifts</p>
            <p className="text-2xl font-bold text-pink-400">{totalGifts}</p>
          </div>
        </div>
      )}

      {/* Tabs */}
      {!loading && (totalSales > 0 || totalGifts > 0) && (
        <div className="flex gap-2">
          {(['all', 'sales', 'gifts'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => { setTab(t); setPage(1); }}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                tab === t
                  ? 'bg-avian-600 text-white'
                  : 'bg-gray-800 text-gray-400 hover:text-white'
              }`}
            >
              {t === 'all' ? 'All' : t === 'sales' ? 'Sales' : 'Gifts'}
            </button>
          ))}
        </div>
      )}

      {loading && <p className="text-gray-400">Loading…</p>}
      {error && <p className="text-red-400">{error}</p>}

      {!loading && isEmpty && (
        <div className="card text-center py-16 space-y-4">
          <History className="w-12 h-12 text-gray-500 mx-auto" />
          <p className="text-gray-300 font-semibold text-lg">No trades yet</p>
          <p className="text-gray-500 text-sm">
            Your completed buys, sells, and gifts will appear here.
          </p>
          <Link href="/marketplace" className="btn-primary inline-block mt-2">
            Browse Marketplace
          </Link>
        </div>
      )}

      {!loading && !isEmpty && (
        <div className="space-y-3">
          {/* Sales */}
          {filteredSales.map((sale) => (
            <Link
              key={`sale-${sale.id}`}
              href={`/listings/${sale.id}`}
              className="card p-4 flex items-center gap-4 hover:border-avian-700 transition-colors"
            >
              {/* Image */}
              <div className="w-12 h-12 rounded-lg overflow-hidden bg-gray-800 shrink-0">
                {sale.asset?.hasIpfs && sale.asset?.ipfsHash && (
                  <IpfsImage hash={sale.asset.ipfsHash} alt={sale.assetName} className="w-full h-full object-cover" />
                )}
              </div>

              {/* Direction indicator */}
              <div className="shrink-0">
                {sale.role === 'bought' ? (
                  <div className="w-8 h-8 rounded-full bg-green-900/40 flex items-center justify-center">
                    <ArrowDownLeft className="w-4 h-4 text-green-400" />
                  </div>
                ) : (
                  <div className="w-8 h-8 rounded-full bg-orange-900/40 flex items-center justify-center">
                    <ArrowUpRight className="w-4 h-4 text-orange-400" />
                  </div>
                )}
              </div>

              {/* Details */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-white truncate">{sale.assetName}</p>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full ${
                      sale.role === 'bought'
                        ? 'bg-green-900/40 text-green-300'
                        : 'bg-orange-900/40 text-orange-300'
                    }`}
                  >
                    {sale.role === 'bought' ? 'Bought' : 'Sold'}
                  </span>
                </div>
                <p className="text-sm text-gray-400 mt-0.5 truncate">
                  {sale.role === 'bought' ? 'From' : 'To'}{' '}
                  {sale.role === 'bought'
                    ? short(sale.sellerAddress)
                    : sale.buyer
                      ? short(sale.buyer)
                      : '—'}
                </p>
              </div>

              {/* Price & date */}
              <div className="text-right shrink-0">
                <p className="font-bold text-avian-400">
                  {sale.soldPrice} <span className="text-sm font-normal text-gray-400">AVN</span>
                </p>
                <p className="text-xs text-gray-500 mt-0.5">{formatDate(sale.updatedAt)}</p>
              </div>
            </Link>
          ))}

          {/* Gifts */}
          {filteredGifts.map((gift) => (
            <div
              key={`gift-${gift.id}`}
              className="card p-4 flex items-center gap-4"
            >
              {/* Icon placeholder */}
              <div className="w-12 h-12 rounded-lg bg-pink-900/20 flex items-center justify-center shrink-0">
                <Gift className="w-6 h-6 text-pink-400" />
              </div>

              {/* Direction indicator */}
              <div className="shrink-0">
                {gift.role === 'received' ? (
                  <div className="w-8 h-8 rounded-full bg-green-900/40 flex items-center justify-center">
                    <ArrowDownLeft className="w-4 h-4 text-green-400" />
                  </div>
                ) : (
                  <div className="w-8 h-8 rounded-full bg-pink-900/40 flex items-center justify-center">
                    <ArrowUpRight className="w-4 h-4 text-pink-400" />
                  </div>
                )}
              </div>

              {/* Details */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-white truncate">{gift.assetName}</p>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full ${
                      gift.role === 'received'
                        ? 'bg-green-900/40 text-green-300'
                        : 'bg-pink-900/40 text-pink-300'
                    }`}
                  >
                    {gift.role === 'received' ? 'Received' : 'Sent'}
                  </span>
                </div>
                <p className="text-sm text-gray-400 mt-0.5 truncate">
                  {gift.role === 'sent' ? 'To' : 'From'}{' '}
                  {gift.role === 'sent'
                    ? short(gift.recipientAddress)
                    : short(gift.senderAddress)}
                </p>
              </div>

              {/* Amount & date */}
              <div className="text-right shrink-0">
                <p className="font-bold text-pink-400">
                  {Number(gift.assetAmount)} <span className="text-sm font-normal text-gray-400">units</span>
                </p>
                <p className="text-xs text-gray-500 mt-0.5">{formatDate(gift.createdAt)}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {total > pageSize && (
        <div className="flex justify-center gap-3 pt-4">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="btn-secondary text-sm disabled:opacity-40"
          >
            ← Previous
          </button>
          <span className="text-gray-400 text-sm self-center">
            Page {page} of {Math.ceil(total / pageSize)}
          </span>
          <button
            onClick={() => setPage((p) => p + 1)}
            disabled={page * pageSize >= total}
            className="btn-secondary text-sm disabled:opacity-40"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
