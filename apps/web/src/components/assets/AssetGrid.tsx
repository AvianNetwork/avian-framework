'use client';

import { useEffect, useState } from 'react';
import { useWallet } from '@/context/WalletContext';
import { api } from '@/lib/api';
import { IpfsImage } from '@/components/ui/IpfsImage';
import { AssetMetadataModal } from '@/components/assets/AssetMetadataModal';
import { LikeButton } from '@/components/ui/LikeButton';
import { toast } from '@/lib/toast';

interface AssetRow {
  name: string;
  amount: number | string;
  units: number;
  reissuable: boolean;
  hasIpfs: boolean;
  ipfsHash?: string;
  _count?: { listings: number };
}

interface Props {
  assets: AssetRow[];
}

export function AssetGrid({ assets }: Props) {
  const { address, isConnected, linkedAddresses } = useWallet();
  const [holdings, setHoldings] = useState<Set<string>>(new Set());
  const [metadataAsset, setMetadataAsset] = useState<string | null>(null);
  const [holderMeta, setHolderMeta] = useState<Record<string, { title?: string | null; description?: string | null }>>({});

  useEffect(() => {
    if (!address) {
      setHoldings(new Set());
      return;
    }
    // Only check balances for the current user's addresses (primary + linked wallets),
    // NOT the full knownAddresses which may contain addresses from other users.
    const addresses = linkedAddresses.length > 0 ? linkedAddresses : [address];
    let cancelled = false;
    Promise.all(addresses.map((addr) => api.getBalances(addr).catch(() => ({} as Record<string, number>))))
      .then((results) => {
        if (cancelled) return;
        const merged = new Set<string>();
        for (const balances of results) {
          for (const name of Object.keys(balances)) merged.add(name);
        }
        setHoldings(merged);
      });
    return () => { cancelled = true; };
  }, [address, linkedAddresses]);

  // Fetch holder metadata for owned assets
  useEffect(() => {
    if (!address || assets.length === 0) return;
    Promise.all(
      assets.map((a) =>
        api.getHolderMetadata(a.name, address)
          .then((m) => [a.name, m] as const)
          .catch(() => [a.name, null] as const)
      )
    ).then((results) => {
      const map: Record<string, { title?: string | null; description?: string | null }> = {};
      for (const [name, m] of results) {
        if (m) map[name] = m as { title?: string | null; description?: string | null };
      }
      setHolderMeta(map);
    });
  }, [address, assets]);

  return (
    <>
      {metadataAsset && (
        <AssetMetadataModal
          assetName={metadataAsset}
          onClose={() => setMetadataAsset(null)}
          onSaved={(name, title, description) =>
            setHolderMeta((prev) => ({ ...prev, [name]: { title, description } }))
          }
        />
      )}
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {assets.map((asset) => {
        const isOwner = isConnected && holdings.has(asset.name);
        return (
          <div
            key={asset.name}
            className={`card space-y-3 transition-colors ${
              isOwner
                ? 'border-avian-600 hover:border-avian-500'
                : 'hover:border-gray-700'
            }`}
          >
            {asset.ipfsHash && (
              <IpfsImage hash={asset.ipfsHash} alt={asset.name} expandable />
            )}
            <div className="flex items-start justify-between">
              <div className="min-w-0">
                <h2 className="font-semibold text-avian-400 break-all">
                  {holderMeta[asset.name]?.title ?? asset.name}
                </h2>
                {holderMeta[asset.name]?.title && (
                  <p className="text-xs text-gray-500 mt-0.5">{asset.name}</p>
                )}
                {holderMeta[asset.name]?.description && (
                  <p className="text-xs text-gray-400 mt-1 line-clamp-2">{holderMeta[asset.name]?.description}</p>
                )}
              </div>
              <div className="flex gap-1 shrink-0 ml-2 flex-wrap justify-end">
                {isOwner && (
                  <span className="badge bg-avian-900/40 text-avian-300 border border-avian-700">
                    Owner
                  </span>
                )}
                {asset.reissuable && (
                  <span className="badge bg-yellow-900/40 text-yellow-400 border border-yellow-800">
                    Reissuable
                  </span>
                )}
                {asset.hasIpfs && (
                  <span className="badge bg-purple-900/40 text-purple-400 border border-purple-800">
                    IPFS
                  </span>
                )}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs text-gray-400">
              <div>
                <p className="text-gray-600 uppercase tracking-wide">Supply</p>
                <p className="text-gray-200 font-medium">{Number(asset.amount).toLocaleString()}</p>
              </div>
              <div>
                <p className="text-gray-600 uppercase tracking-wide">Units</p>
                <p className="text-gray-200 font-medium">{asset.units}</p>
              </div>
            </div>
            <div className="border-t border-gray-800 pt-3 flex gap-2 flex-wrap items-center">
              <LikeButton type="asset" id={asset.name} />
              {(asset._count?.listings ?? 0) > 0 && (
                <a
                  href={`/marketplace?asset=${encodeURIComponent(asset.name)}`}
                  className="btn-secondary text-xs py-1 flex-1 text-center"
                >
                  View Listings
                </a>
              )}
              {isOwner ? (
                <a
                  href={`/listings/create?asset=${encodeURIComponent(asset.name)}`}
                  className="btn-primary text-xs py-1 flex-1 text-center"
                >
                  List Asset
                </a>
              ) : (
                <button
                  className="btn-primary text-xs py-1 flex-1 text-center"
                  onClick={() => {
                    if (!isConnected) {
                      toast('Connect your wallet to make an offer.', 'error');
                      return;
                    }
                    window.location.href = `/blind-offers/create?asset=${encodeURIComponent(asset.name)}`;
                  }}
                >
                  Make Offer
                </button>
              )}
              {isOwner && (
                <button
                  onClick={() => setMetadataAsset(asset.name)}
                  className="btn-secondary text-xs py-1 w-full"
                >
                  Metadata
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
    </>
  );
}
