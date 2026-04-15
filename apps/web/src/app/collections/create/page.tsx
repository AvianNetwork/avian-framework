'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useWallet } from '../../../context/WalletContext';
import { api } from '../../../lib/api';
import { toast } from '../../../lib/toast';

export default function CreateCollectionPage() {
  const router = useRouter();
  const { token, isConnected } = useWallet();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [website, setWebsite] = useState('');
  const [twitter, setTwitter] = useState('');
  const [discord, setDiscord] = useState('');
  const [royalty, setRoyalty] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleCreate() {
    if (!token) return;
    if (!name.trim()) { setError('Collection name is required.'); return; }
    setLoading(true); setError('');
    try {
      const created = (await api.createCollection({
        name: name.trim(),
        description: description || undefined,
        website: website || undefined,
        twitterHandle: twitter || undefined,
        discordHandle: discord || undefined,
        royaltyPercent: royalty ? Number(royalty) : undefined,
      }, token)) as { slug: string };
      toast('Collection created!');
      router.push(`/collections/${created.slug}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create collection.');
    } finally {
      setLoading(false);
    }
  }

  if (!isConnected) {
    return (
      <div className="max-w-xl mx-auto card text-center py-12 text-gray-400">
        Connect your wallet to create a collection.
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Create Collection</h1>

      <div className="card space-y-4">
        {error && <p className="text-red-400 text-sm bg-red-900/20 rounded px-3 py-2">{error}</p>}

        <div>
          <label className="label">Collection Name <span className="text-red-400">*</span></label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)}
            placeholder="My Awesome Collection" />
        </div>

        <div>
          <label className="label">Description</label>
          <textarea className="input min-h-[80px] resize-y" value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe your collection…" />
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="label">Website</label>
            <input className="input" value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://…" />
          </div>
          <div>
            <label className="label">Twitter</label>
            <input className="input" value={twitter} onChange={(e) => setTwitter(e.target.value)} placeholder="@handle" />
          </div>
          <div>
            <label className="label">Discord</label>
            <input className="input" value={discord} onChange={(e) => setDiscord(e.target.value)} placeholder="user#0000" />
          </div>
        </div>

        <div className="w-40">
          <label className="label">Royalty % <span className="text-gray-500 font-normal">(0–15)</span></label>
          <input className="input" type="number" min="0" max="15" step="0.5"
            value={royalty} onChange={(e) => setRoyalty(e.target.value)} placeholder="e.g. 5" />
        </div>

        <div className="flex gap-3 pt-2">
          <button onClick={handleCreate} disabled={loading} className="btn-primary">
            {loading ? 'Creating…' : 'Create Collection'}
          </button>
          <button onClick={() => router.back()} className="btn-secondary">Cancel</button>
        </div>
      </div>
    </div>
  );
}
