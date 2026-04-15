'use client';

import { useState, useRef, useEffect } from 'react';
import { X, CheckCircle2, Globe } from 'lucide-react';
import { AssetMetadataModal } from '../../../components/assets/AssetMetadataModal';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { useWallet } from '../../../context/WalletContext';
import { api } from '../../../lib/api';
import { toast } from '../../../lib/toast';
import { IpfsImage } from '../../../components/ui/IpfsImage';
import { LikeButton } from '../../../components/ui/LikeButton';
import type { CollectionData } from './page';

const API_BASE = process.env['NEXT_PUBLIC_API_URL']?.replace('/api/v1', '') ?? 'http://localhost:4000';

export function CollectionDetail({ collection: initial }: { collection: CollectionData }) {
  const router = useRouter();
  const { address, token, isConnected } = useWallet();
  const [collection, setCollection] = useState(initial);
  const isOwner = address === collection.ownerAddress;

  // Edit mode
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(collection.name);
  const [editDesc, setEditDesc] = useState(collection.description ?? '');
  const [editWebsite, setEditWebsite] = useState(collection.website ?? '');
  const [editTwitter, setEditTwitter] = useState(collection.twitterHandle ?? '');
  const [editDiscord, setEditDiscord] = useState(collection.discordHandle ?? '');
  const [editRoyalty, setEditRoyalty] = useState(collection.royaltyPercent?.toString() ?? '');
  const [saving, setSaving] = useState(false);

  // Metadata modal
  const [metadataAsset, setMetadataAsset] = useState<string | null>(null);

  // Holder metadata for item cards (keyed by assetName)
  const [holderMeta, setHolderMeta] = useState<Record<string, { title?: string | null; description?: string | null }>>({});

  useEffect(() => {
    if (collection.items.length === 0) return;
    Promise.all(
      collection.items.map((item) =>
        api.getHolderMetadata(item.assetName, collection.ownerAddress)
          .then((m) => [item.assetName, m] as const)
          .catch(() => [item.assetName, null] as const)
      )
    ).then((results) => {
      const map: Record<string, { title?: string | null; description?: string | null }> = {};
      for (const [name, m] of results) {
        if (m) map[name] = m as { title?: string | null; description?: string | null };
      }
      setHolderMeta(map);
    });
  }, [collection.items, collection.ownerAddress]);

  // Add asset
  const [addAsset, setAddAsset] = useState('');
  const [adding, setAdding] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [removeAsset, setRemoveAsset] = useState<string | null>(null);

  const avatarRef = useRef<HTMLInputElement>(null);
  const bannerRef = useRef<HTMLInputElement>(null);

  async function handleSaveEdit() {
    if (!token) return;
    setSaving(true);
    try {
      const updated = (await api.updateCollection(collection.slug, {
        name: editName,
        description: editDesc || undefined,
        website: editWebsite || undefined,
        twitterHandle: editTwitter || undefined,
        discordHandle: editDiscord || undefined,
        royaltyPercent: editRoyalty ? Number(editRoyalty) : undefined,
      }, token)) as CollectionData;
      setCollection((c) => ({ ...c, ...updated }));
      setEditing(false);
      toast('Collection updated.');
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : 'Update failed.', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!token) return;
    setShowDeleteModal(false);
    try {
      await api.deleteCollection(collection.slug, token);
      toast('Collection deleted.');
      router.push('/collections');
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : 'Delete failed.', 'error');
    }
  }

  async function handleAddAsset() {
    if (!token || !addAsset.trim()) return;
    setAdding(true);
    try {
      const newItem = (await api.addCollectionItem(collection.slug, addAsset.trim(), token)) as CollectionData['items'][number];
      setCollection((c) => ({
        ...c,
        items: [...c.items, newItem],
        _count: { ...c._count, items: c._count.items + 1 },
      }));
      toast('Asset added.');
      setAddAsset('');
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : 'Failed to add asset.', 'error');
    } finally {
      setAdding(false);
    }
  }

  async function handleRemoveAsset(assetName: string) {
    if (!token) return;
    setRemoveAsset(null);
    try {
      await api.removeCollectionItem(collection.slug, assetName, token);
      setCollection((c) => ({ ...c, items: c.items.filter((i) => i.assetName !== assetName) }));
      toast('Asset removed.');
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : 'Failed to remove asset.', 'error');
    }
  }

  async function handleImageUpload(file: File, type: 'avatar' | 'banner') {
    if (!token) return;
    try {
      const updated = (type === 'avatar'
        ? await api.uploadCollectionAvatar(collection.slug, file, token)
        : await api.uploadCollectionBanner(collection.slug, file, token)) as CollectionData;
      setCollection((c) => ({ ...c, avatarUrl: updated.avatarUrl ?? c.avatarUrl, bannerUrl: updated.bannerUrl ?? c.bannerUrl }));
      toast(`${type === 'avatar' ? 'Avatar' : 'Banner'} updated.`);
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : 'Upload failed.', 'error');
    }
  }

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
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Link href="/collections" className="hover:text-white transition-colors">Collections</Link>
        <span>›</span>
        <span className="text-gray-300">{collection.name}</span>
      </div>

      {/* Banner */}
      <div
        className={`relative h-48 rounded-2xl overflow-hidden bg-gray-800 ${isOwner ? 'cursor-pointer group' : ''}`}
        onClick={() => isOwner && bannerRef.current?.click()}
      >
        {collection.bannerUrl && (
          <Image src={`${API_BASE}${collection.bannerUrl}`} alt="Banner" fill className="object-cover" />
        )}
        {isOwner && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
            <span className="text-white text-sm">Change banner</span>
          </div>
        )}
        <input ref={bannerRef} type="file" accept="image/*" className="hidden"
          onChange={(e) => e.target.files?.[0] && handleImageUpload(e.target.files[0], 'banner')} />
      </div>

      {/* Avatar + header */}
      <div className="flex flex-col sm:flex-row sm:items-end gap-3 -mt-12 px-4">
        <div
          className={`relative w-20 h-20 rounded-full border-4 border-gray-950 overflow-hidden bg-gray-700 shrink-0 ${isOwner ? 'cursor-pointer group' : ''}`}
          onClick={() => isOwner && avatarRef.current?.click()}
        >
          {collection.avatarUrl ? (
            <Image src={`${API_BASE}${collection.avatarUrl}`} alt={collection.name} fill className="object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-2xl font-bold text-gray-400">
              {collection.name.charAt(0)}
            </div>
          )}
          {isOwner && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-full">
              <span className="text-xs text-white">Edit</span>
            </div>
          )}
          <input ref={avatarRef} type="file" accept="image/*" className="hidden"
            onChange={(e) => e.target.files?.[0] && handleImageUpload(e.target.files[0], 'avatar')} />
        </div>
        <div className="flex-1 mt-2 sm:mt-0 sm:pb-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold break-words">{collection.name}</h1>
            {collection.isVerified && <CheckCircle2 className="w-4 h-4 text-avian-400" />}
          </div>
          <p className="text-sm text-gray-400">
            by{' '}
            {collection.owner.username ? (
              <Link href={`/users/${collection.owner.username}`} className="hover:text-avian-400">
                {collection.owner.displayName ?? collection.owner.username}
              </Link>
            ) : (
              <code className="text-xs">{collection.ownerAddress.slice(0, 16)}…</code>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2 sm:pb-1 mt-1 sm:mt-0">
          <LikeButton type="collection" id={collection.slug} />
          {isOwner && (
            <>
              <button onClick={() => setEditing(!editing)} className="btn-secondary text-sm">
                {editing ? 'Cancel' : 'Edit'}
              </button>
              <button onClick={() => setShowDeleteModal(true)} className="btn-secondary text-sm text-red-400 hover:text-red-300">
                Delete
              </button>
            </>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="flex flex-wrap gap-x-6 gap-y-2 px-4 text-sm">
        <div><span className="font-semibold text-white">{collection._count.items}</span> <span className="text-gray-400">items</span></div>
        {collection.royaltyPercent !== null && (
          <div><span className="font-semibold text-white">{Number(collection.royaltyPercent)}%</span> <span className="text-gray-400">royalty</span></div>
        )}
        {collection.website && (
          <a href={collection.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-avian-400 hover:underline"><Globe className="w-4 h-4" /> Website</a>
        )}
        {collection.twitterHandle && (
          <a href={`https://x.com/${collection.twitterHandle.replace('@', '')}`} target="_blank" rel="noopener noreferrer"
            className="text-avian-400 hover:underline">𝕏 {collection.twitterHandle}</a>
        )}
      </div>

      {collection.description && !editing && (
        <p className="px-4 text-gray-300 text-sm leading-relaxed">{collection.description}</p>
      )}

      {/* Edit form */}
      {editing && (
        <div className="card space-y-4">
          <h2 className="font-semibold">Edit Collection</h2>
          <div>
            <label className="label">Name</label>
            <input className="input" value={editName} onChange={(e) => setEditName(e.target.value)} />
          </div>
          <div>
            <label className="label">Description</label>
            <textarea className="input min-h-[80px] resize-y" value={editDesc}
              onChange={(e) => setEditDesc(e.target.value)} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div><label className="label">Website</label><input className="input" value={editWebsite} onChange={(e) => setEditWebsite(e.target.value)} /></div>
            <div><label className="label">Twitter</label><input className="input" value={editTwitter} onChange={(e) => setEditTwitter(e.target.value)} /></div>
            <div><label className="label">Discord</label><input className="input" value={editDiscord} onChange={(e) => setEditDiscord(e.target.value)} /></div>
          </div>
          <div className="w-40">
            <label className="label">Royalty % (0–15)</label>
            <input className="input" type="number" min="0" max="15" step="0.5" value={editRoyalty}
              onChange={(e) => setEditRoyalty(e.target.value)} />
          </div>
          <button onClick={handleSaveEdit} disabled={saving} className="btn-primary">
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      )}

      {/* Add asset (owner only) */}
      {isOwner && isConnected && (
        <div className="card space-y-3">
          <h2 className="font-semibold">Add Asset to Collection</h2>
          <div className="flex gap-2">
            <input className="input flex-1" placeholder="Asset name (e.g. MYTOKEN)" value={addAsset}
              onChange={(e) => setAddAsset(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddAsset()} />
            <button onClick={handleAddAsset} disabled={adding || !addAsset.trim()} className="btn-primary shrink-0">
              {adding ? 'Adding…' : 'Add'}
            </button>
          </div>
        </div>
      )}

      {/* Items grid */}
      {collection.items.length === 0 ? (
        <div className="card text-center py-12 text-gray-400">
          No assets in this collection yet.
          {isOwner && <p className="text-sm mt-1">Add assets using the form above.</p>}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {collection.items.map((item) => (
            <div key={item.assetName} className="card p-3 space-y-2 relative group">
              <div className="aspect-square bg-gray-800 rounded-xl overflow-hidden">
                {item.asset.hasIpfs && item.asset.ipfsHash ? (
                  <IpfsImage hash={item.asset.ipfsHash} alt={item.assetName} className="w-full h-full object-cover" expandable />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-600 text-xs">No image</div>
                )}
              </div>
              <Link href={`/assets?filter=${encodeURIComponent(item.assetName)}`}
                className="block text-sm font-medium truncate hover:text-avian-400">
                {holderMeta[item.assetName]?.title ?? item.assetName}
              </Link>
              {holderMeta[item.assetName]?.title && (
                <p className="text-xs text-gray-500 truncate">{item.assetName}</p>
              )}
              {holderMeta[item.assetName]?.description && (
                <p className="text-xs text-gray-400 line-clamp-2">{holderMeta[item.assetName]?.description}</p>
              )}
              <div className="flex gap-1">
                {isOwner && (
                  <button
                    onClick={() => setMetadataAsset(item.assetName)}
                    className="btn-secondary text-xs py-0.5 flex-1"
                  >
                    Metadata
                  </button>
                )}
                {isOwner && (
                  <button
                    onClick={() => setRemoveAsset(item.assetName)}
                    className="px-2 py-0.5 text-xs text-red-400 hover:bg-red-900/20 rounded border border-red-800/60"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl p-6 w-full max-w-sm space-y-4">
            <h2 className="text-lg font-semibold text-white">Delete collection?</h2>
            <p className="text-sm text-gray-400">This will permanently delete <span className="font-medium text-white">{collection.name}</span>. This cannot be undone.</p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="px-4 py-2 text-sm rounded-lg border border-gray-600 text-gray-300 hover:bg-gray-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="px-4 py-2 text-sm rounded-lg bg-red-600 hover:bg-red-700 text-white font-medium transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {removeAsset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl p-6 w-full max-w-sm space-y-4">
            <h2 className="text-lg font-semibold text-white">Remove asset?</h2>
            <p className="text-sm text-gray-400">Remove <span className="font-medium text-white">{removeAsset}</span> from this collection?</p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setRemoveAsset(null)}
                className="px-4 py-2 text-sm rounded-lg border border-gray-600 text-gray-300 hover:bg-gray-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleRemoveAsset(removeAsset)}
                className="px-4 py-2 text-sm rounded-lg bg-red-600 hover:bg-red-700 text-white font-medium transition-colors"
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    </>
  );
}
