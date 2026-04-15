'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useState } from 'react';

export function MarketplaceFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [asset, setAsset] = useState(searchParams.get('asset') ?? '');
  const [minPrice, setMinPrice] = useState(searchParams.get('minPrice') ?? '');
  const [maxPrice, setMaxPrice] = useState(searchParams.get('maxPrice') ?? '');
  const [sort, setSort] = useState(searchParams.get('sort') ?? 'newest');

  const applyFilters = useCallback(() => {
    const qs = new URLSearchParams();
    if (asset.trim()) qs.set('asset', asset.trim());
    if (minPrice.trim()) qs.set('minPrice', minPrice.trim());
    if (maxPrice.trim()) qs.set('maxPrice', maxPrice.trim());
    if (sort && sort !== 'newest') qs.set('sort', sort);
    const query = qs.toString();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    router.push(`/marketplace${query ? `?${query}` : ''}` as any);
  }, [asset, minPrice, maxPrice, sort, router]);

  const clearFilters = useCallback(() => {
    setAsset('');
    setMinPrice('');
    setMaxPrice('');
    setSort('newest');
    router.push('/marketplace');
  }, [router]);

  const hasFilters =
    searchParams.has('asset') ||
    searchParams.has('minPrice') ||
    searchParams.has('maxPrice') ||
    (searchParams.has('sort') && searchParams.get('sort') !== 'newest');

  return (
    <div className="card p-4">
      <div className="flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-[160px]">
          <label className="block text-xs text-gray-400 mb-1">Asset name</label>
          <input
            type="text"
            placeholder="Filter by asset…"
            value={asset}
            onChange={(e) => setAsset(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && applyFilters()}
            className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-avian-500"
          />
        </div>
        <div className="w-32">
          <label className="block text-xs text-gray-400 mb-1">Min price (AVN)</label>
          <input
            type="number"
            min={0}
            placeholder="0"
            value={minPrice}
            onChange={(e) => setMinPrice(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-avian-500"
          />
        </div>
        <div className="w-32">
          <label className="block text-xs text-gray-400 mb-1">Max price (AVN)</label>
          <input
            type="number"
            min={0}
            placeholder="∞"
            value={maxPrice}
            onChange={(e) => setMaxPrice(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-avian-500"
          />
        </div>
        <div className="w-40">
          <label className="block text-xs text-gray-400 mb-1">Sort</label>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-avian-500"
          >
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="price_asc">Price: low → high</option>
            <option value="price_desc">Price: high → low</option>
          </select>
        </div>
        <div className="flex gap-2">
          <button onClick={applyFilters} className="btn-primary text-sm px-4 py-2">
            Apply
          </button>
          {hasFilters && (
            <button onClick={clearFilters} className="btn-secondary text-sm px-4 py-2">
              Clear
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
