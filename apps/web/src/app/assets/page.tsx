import type { Metadata } from 'next';
import { api } from '@/lib/api';
import { AssetGrid } from '@/components/assets/AssetGrid';
import { AssetSearchForm } from '@/components/assets/AssetSearchForm';

export const metadata: Metadata = {
  title: 'Assets',
  description: 'Browse all assets on the Avian blockchain — including IPFS-backed NFTs and reissuable tokens.',
};

export default async function AssetsPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; page?: string }>;
}) {
  const params = await searchParams;
  const page = Number(params.page ?? 1);
  const filter = params.filter ?? '';

  let assets: AssetRow[] = [];
  let total = 0;

  try {
    const result = (await api.listAssets(filter, page)) as {
      data: AssetRow[];
      total: number;
    };
    assets = result.data;
    total = result.total;
  } catch {
    // API may be temporarily unavailable
  }

  const pageSize = 50;
  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Assets</h1>
          <p className="text-gray-400 mt-1">
            {total > 0 ? `${total} assets with IPFS metadata` : 'Scanning chain…'}
          </p>
        </div>
      </div>

      {/* Search */}
      <AssetSearchForm defaultValue={filter} />

      {/* Assets grid */}
      {assets.length === 0 ? (
        <div className="card text-center py-16 text-gray-500">
          {total === 0
            ? 'The indexer is syncing assets from the chain. Check back shortly.'
            : 'No assets match your search.'}
        </div>
      ) : (
        <AssetGrid assets={assets} />
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-4">
          {page > 1 && (
            <a
              href={`/assets?filter=${encodeURIComponent(filter)}&page=${page - 1}`}
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
              href={`/assets?filter=${encodeURIComponent(filter)}&page=${page + 1}`}
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

interface AssetRow {
  name: string;
  amount: number | string;
  units: number;
  reissuable: boolean;
  hasIpfs: boolean;
  ipfsHash?: string;
}
