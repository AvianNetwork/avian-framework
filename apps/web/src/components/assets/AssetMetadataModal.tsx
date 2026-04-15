'use client';

import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { useWallet } from '../../context/WalletContext';
import { api } from '../../lib/api';
import { toast } from '../../lib/toast';

interface Trait {
  trait_type: string;
  value: string;
}

interface AssetMeta {
  assetName: string;
  title: string | null;
  description: string | null;
  externalUrl: string | null;
  traits: Trait[] | null;
}

interface Props {
  assetName: string;
  onClose: () => void;
  onSaved?: (assetName: string, title: string | null, description: string | null) => void;
}

export function AssetMetadataModal({ assetName, onClose, onSaved }: Props) {
  const { token, address, isConnected } = useWallet();

  const [meta, setMeta] = useState<AssetMeta | null>(null);
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [externalUrl, setExternalUrl] = useState('');
  const [traits, setTraits] = useState<Trait[]>([]);

  useEffect(() => {
    setLoading(true);
    const fetchAll = async () => {
      const [metaRes, noteRes] = await Promise.all([
        // Load the holder's own public metadata (falls back to null if none set yet)
        address ? api.getHolderMetadata(assetName, address).catch(() => null) : Promise.resolve(null),
        token ? api.getHolderNote(assetName, token).catch(() => null) : null,
      ]);
      const m = metaRes as AssetMeta | null;
      setMeta(m);
      setTitle(m?.title ?? '');
      setDescription(m?.description ?? '');
      setExternalUrl(m?.externalUrl ?? '');
      setTraits(m?.traits ?? []);
      setNote((noteRes as { note?: string } | null)?.note ?? '');
      setLoading(false);
    };
    fetchAll();
  }, [assetName, token, address]);

  async function handleSaveMeta() {
    if (!token) return;
    setSaving(true);
    try {
      await api.setHolderMetadata(assetName, {
        title: title || undefined,
        description: description || undefined,
        externalUrl: externalUrl || undefined,
        traits: traits.filter((t) => t.trait_type && t.value),
      }, token);
      toast('Metadata saved.');
      onSaved?.(assetName, title || null, description || null);
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : 'Failed to save metadata.', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveNote() {
    if (!token) return;
    setSaving(true);
    try {
      await api.setHolderNote(assetName, note, token);
      toast('Note saved.');
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : 'Failed to save note.', 'error');
    } finally {
      setSaving(false);
    }
  }

  function addTrait() {
    setTraits((t) => [...t, { trait_type: '', value: '' }]);
  }

  function updateTrait(idx: number, field: 'trait_type' | 'value', val: string) {
    setTraits((t) => t.map((tr, i) => i === idx ? { ...tr, [field]: val } : tr));
  }

  function removeTrait(idx: number) {
    setTraits((t) => t.filter((_, i) => i !== idx));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70" onClick={onClose}>
      <div
        className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
          <div>
            <h2 className="font-semibold">Asset Metadata</h2>
            <p className="text-xs text-gray-400 mt-0.5">{assetName}</p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white"><X className="w-5 h-5" /></button>
        </div>

        {loading ? (
          <div className="px-6 py-12 text-center text-gray-400">Loading…</div>
        ) : (
          <div className="px-6 py-5 space-y-6">
            {/* Public metadata — editable by holder */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-gray-300 uppercase tracking-wide">My Metadata</h3>
              <p className="text-xs text-gray-500">Shown on your listings and collection entries.</p>

              <div>
                <label className="label">Title</label>
                <input className="input" value={title} onChange={(e) => setTitle(e.target.value)}
                  placeholder={assetName} />
              </div>
              <div>
                <label className="label">Description</label>
                <textarea className="input min-h-[80px] resize-y" value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe this asset…" />
              </div>
              <div>
                <label className="label">External URL</label>
                <input className="input" value={externalUrl} onChange={(e) => setExternalUrl(e.target.value)}
                  placeholder="https://…" />
              </div>

              {/* Traits */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="label mb-0">Traits / Properties</label>
                  <button onClick={addTrait} className="text-xs text-avian-400 hover:underline">+ Add trait</button>
                </div>
                {traits.map((t, idx) => (
                  <div key={idx} className="flex gap-2 items-center">
                    <input className="input flex-1 text-xs" placeholder="Type (e.g. Color)" value={t.trait_type}
                      onChange={(e) => updateTrait(idx, 'trait_type', e.target.value)} />
                    <input className="input flex-1 text-xs" placeholder="Value (e.g. Blue)" value={t.value}
                      onChange={(e) => updateTrait(idx, 'value', e.target.value)} />
                    <button onClick={() => removeTrait(idx)} className="text-red-400 shrink-0"><X className="w-4 h-4" /></button>
                  </div>
                ))}
              </div>

              {isConnected ? (
                <button onClick={handleSaveMeta} disabled={saving} className="btn-primary w-full">
                  {saving ? 'Saving…' : 'Save Public Metadata'}
                </button>
              ) : (
                <p className="text-xs text-gray-500 text-center">Connect your wallet to edit metadata.</p>
              )}
            </div>

            {/* Private holder note */}
            {isConnected && (
              <div className="space-y-3 border-t border-gray-800 pt-5">
                <h3 className="text-sm font-medium text-gray-300 uppercase tracking-wide">Private Note</h3>
                <p className="text-xs text-gray-500">Only visible to you. Never shown publicly.</p>
                <textarea className="input min-h-[80px] resize-y" value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Your private notes about this asset…" />
                <button onClick={handleSaveNote} disabled={saving} className="btn-secondary w-full">
                  {saving ? 'Saving…' : 'Save Private Note'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
