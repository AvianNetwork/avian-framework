'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { CheckCircle2 } from 'lucide-react';
import { useWallet } from '../../context/WalletContext';
import { api } from '../../lib/api';
import { toast } from '../../lib/toast';
import { CopyButton } from '../../components/ui/CopyButton';

interface UserProfile {
  id: string;
  address: string;
  username: string | null;
  displayName: string | null;
  bio: string | null;
  avatarUrl: string | null;
  bannerUrl: string | null;
  bannerPosition: string | null;
  website: string | null;
  twitterHandle: string | null;
  discordHandle: string | null;
  wallets: { id: string; address: string; label: string | null; isPrimary: boolean }[];
  collections: { id: string; slug: string; name: string; avatarUrl: string | null; isVerified: boolean }[];
}

const API_BASE = process.env['NEXT_PUBLIC_API_URL']?.replace('/api/v1', '') ?? 'http://localhost:4000';

export default function ProfilePage() {
  const router = useRouter();
  const { address, token, isConnected } = useWallet();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Editable fields
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [website, setWebsite] = useState('');
  const [twitter, setTwitter] = useState('');
  const [discord, setDiscord] = useState('');

  // Wallet linking
  const [linking, setLinking] = useState(false);
  const [linkAddress, setLinkAddress] = useState('');
  const [linkLabel, setLinkLabel] = useState('');
  const [linkChallenge, setLinkChallenge] = useState('');
  const [linkStep, setLinkStep] = useState<'idle' | 'challenge' | 'verify'>('idle');
  const [unlinkAddress, setUnlinkAddress] = useState<string | null>(null);
  const [editingLabel, setEditingLabel] = useState<{ address: string; value: string } | null>(null);

  const avatarRef = useRef<HTMLInputElement>(null);
  const bannerRef = useRef<HTMLInputElement>(null);
  const bannerDivRef = useRef<HTMLDivElement>(null);

  // Banner drag-to-reposition state
  const [bannerPos, setBannerPos] = useState<{ x: number; y: number }>({ x: 50, y: 50 });
  const [isDragging, setIsDragging] = useState(false);
  const [isRepositioning, setIsRepositioning] = useState(false);
  const [posSaved, setPosSaved] = useState(true);
  const dragStart = useRef<{ mouseX: number; mouseY: number; posX: number; posY: number } | null>(null);

  useEffect(() => {
    if (!isConnected || !token) { setLoading(false); return; }
    api.getMyProfile(token)
      .then((p) => {
        const data = p as UserProfile;
        setProfile(data);
        setUsername(data.username ?? '');
        setDisplayName(data.displayName ?? '');
        setBio(data.bio ?? '');
        setWebsite(data.website ?? '');
        setTwitter(data.twitterHandle ?? '');
        setDiscord(data.discordHandle ?? '');
        // Parse saved banner position
        const pos = data.bannerPosition ?? '50% 50%';
        const [px, py] = pos.split(' ').map((v) => parseFloat(v));
        setBannerPos({ x: px ?? 50, y: py ?? 50 });
      })
      .catch(() => setError('Failed to load profile.'))
      .finally(() => setLoading(false));
  }, [isConnected, token]);

  async function handleSave() {
    if (!token) return;
    setSaving(true);
    setError(''); setSuccess('');
    try {
      await api.updateProfile({
        username: username || undefined,
        displayName: displayName || undefined,
        bio: bio || undefined,
        website: website || undefined,
        twitterHandle: twitter || undefined,
        discordHandle: discord || undefined,
      }, token);
      setSuccess('Profile updated.');
      toast('Profile saved.');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Save failed.');
    } finally {
      setSaving(false);
    }
  }

  async function handleImageUpload(file: File, type: 'avatar' | 'banner') {
    if (!token) return;
    try {
      const updated = (type === 'avatar'
        ? await api.uploadProfileAvatar(file, token)
        : await api.uploadProfileBanner(file, token)) as UserProfile;
      setProfile((p) => p ? { ...p, avatarUrl: updated.avatarUrl ?? p.avatarUrl, bannerUrl: updated.bannerUrl ?? p.bannerUrl } : p);
      toast(`${type === 'avatar' ? 'Avatar' : 'Banner'} updated.`);
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : 'Upload failed.', 'error');
    }
  }

  async function handleRequestLinkChallenge() {
    if (!token || !linkAddress) return;
    setLinking(true);
    try {
      const { challenge } = await api.issueLinkChallenge(linkAddress, token);
      setLinkChallenge(challenge);
      setLinkStep('challenge');
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : 'Failed to get challenge.', 'error');
    } finally {
      setLinking(false);
    }
  }

  async function handleConfirmLink(signature: string) {
    if (!token) return;
    setLinking(true);
    try {
      await api.linkWallet({ newAddress: linkAddress, challenge: linkChallenge, signature, label: linkLabel || undefined }, token);
      toast('Wallet linked!');
      setLinkStep('idle'); setLinkAddress(''); setLinkLabel(''); setLinkChallenge('');
      // Refresh
      const updated = await api.getMyProfile(token);
      setProfile(updated as UserProfile);
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : 'Failed to link wallet.', 'error');
    } finally {
      setLinking(false);
    }
  }

  async function handleUnlink(walletAddress: string) {
    if (!token) return;
    try {
      await api.unlinkWallet(walletAddress, token);
      setProfile((p) => p ? { ...p, wallets: p.wallets.filter((w) => w.address !== walletAddress) } : p);
      setUnlinkAddress(null);
      toast('Wallet unlinked.');
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : 'Failed to unlink.', 'error');
    }
  }

  async function handleSaveLabel(walletAddress: string, label: string) {
    if (!token) return;
    const trimmed = label.trim() || null;
    try {
      await api.updateWalletLabel(walletAddress, trimmed, token);
      setProfile((p) => p ? { ...p, wallets: p.wallets.map((w) => w.address === walletAddress ? { ...w, label: trimmed } : w) } : p);
      setEditingLabel(null);
      toast('Label updated.');
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : 'Failed to update label.', 'error');
    }
  }

  async function handleSetPrimary(walletAddress: string) {
    if (!token) return;
    try {
      await api.setDisplayPrimary(walletAddress, token);
      setProfile((p) => p ? { ...p, wallets: p.wallets.map((w) => ({ ...w, isPrimary: w.address === walletAddress })) } : p);
      toast('Display primary updated.');
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : 'Failed to update primary.', 'error');
    }
  }

  const handleBannerMouseDown = useCallback((e: React.MouseEvent) => {
    if (!isRepositioning) return;
    e.preventDefault();
    dragStart.current = { mouseX: e.clientX, mouseY: e.clientY, posX: bannerPos.x, posY: bannerPos.y };
    setIsDragging(true);
  }, [isRepositioning, bannerPos]);

  const handleBannerMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging || !dragStart.current || !bannerDivRef.current) return;
    const rect = bannerDivRef.current.getBoundingClientRect();
    const dx = ((e.clientX - dragStart.current.mouseX) / rect.width) * -100;
    const dy = ((e.clientY - dragStart.current.mouseY) / rect.height) * -100;
    setBannerPos({
      x: Math.max(0, Math.min(100, dragStart.current.posX + dx)),
      y: Math.max(0, Math.min(100, dragStart.current.posY + dy)),
    });
    setPosSaved(false);
  }, [isDragging]);

  const handleBannerMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  async function handleSaveBannerPosition() {
    if (!token) return;
    const posStr = `${bannerPos.x.toFixed(1)}% ${bannerPos.y.toFixed(1)}%`;
    try {
      await api.updateProfile({ bannerPosition: posStr }, token);
      setPosSaved(true);
      toast('Banner position saved.');
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : 'Failed to save position.', 'error');
    }
  }

  if (!isConnected) {
    return (
      <div className="max-w-2xl mx-auto card text-center py-12">
        <p className="text-gray-400">Connect your wallet to view and edit your profile.</p>
      </div>
    );
  }

  if (loading) return <div className="max-w-2xl mx-auto card py-12 text-center text-gray-400">Loading…</div>;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">My Profile</h1>
        {profile?.username && (
          <Link href={`/users/${profile.username}`} className="text-sm text-avian-400 hover:underline">
            View public profile →
          </Link>
        )}
      </div>

      {/* Banner + Avatar */}
      <div className="card space-y-4">
        <h2 className="font-semibold">Profile Images</h2>
        {/* Banner */}
        <div className="space-y-2">
          <div
            ref={bannerDivRef}
            className={`relative h-32 rounded-xl overflow-hidden bg-gray-800 ${isRepositioning ? (isDragging ? 'cursor-grabbing' : 'cursor-grab') : 'cursor-pointer group'}`}
            onClick={() => !isRepositioning && bannerRef.current?.click()}
            onMouseDown={handleBannerMouseDown}
            onMouseMove={handleBannerMouseMove}
            onMouseUp={handleBannerMouseUp}
            onMouseLeave={handleBannerMouseUp}
          >
            {profile?.bannerUrl && (
              <Image
                src={`${API_BASE}${profile.bannerUrl}`}
                alt="Banner"
                fill
                draggable={false}
                className="object-cover select-none"
                style={{ objectPosition: `${bannerPos.x}% ${bannerPos.y}%` }}
              />
            )}
            {!isRepositioning && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
                <span className="text-sm text-white">Change banner</span>
              </div>
            )}
            {isRepositioning && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <span className="text-xs text-white bg-black/60 px-2 py-1 rounded">Drag to reposition</span>
              </div>
            )}
            <input ref={bannerRef} type="file" accept="image/*" className="hidden"
              onChange={(e) => e.target.files?.[0] && handleImageUpload(e.target.files[0], 'banner')} />
          </div>
          {profile?.bannerUrl && (
            <div className="flex gap-2">
              <button
                onClick={() => { setIsRepositioning((v) => !v); setIsDragging(false); }}
                className={`text-xs px-3 py-1 rounded border transition-colors ${isRepositioning ? 'border-avian-500 text-avian-400 bg-avian-900/20' : 'border-gray-700 text-gray-400 hover:text-white'}`}
              >
                {isRepositioning ? 'Done repositioning' : 'Reposition'}
              </button>
              {isRepositioning && !posSaved && (
                <button
                  onClick={handleSaveBannerPosition}
                  className="text-xs px-3 py-1 rounded border border-green-700 text-green-400 hover:bg-green-900/20 transition-colors"
                >
                  Save position
                </button>
              )}
            </div>
          )}
        </div>
        {/* Avatar */}
        <div className="flex items-center gap-4">
          <div
            className="relative w-20 h-20 rounded-full overflow-hidden bg-gray-700 cursor-pointer group shrink-0"
            onClick={() => avatarRef.current?.click()}
          >
            {profile?.avatarUrl ? (
              <Image src={`${API_BASE}${profile.avatarUrl}`} alt="Avatar" fill className="object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-2xl text-gray-500">
                {address?.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-full">
              <span className="text-xs text-white text-center">Change</span>
            </div>
            <input ref={avatarRef} type="file" accept="image/*" className="hidden"
              onChange={(e) => e.target.files?.[0] && handleImageUpload(e.target.files[0], 'avatar')} />
          </div>
          <div className="text-sm text-gray-400">Click your avatar or banner to upload a new image (max 5 MB, PNG/JPG/GIF/WebP).</div>
        </div>
      </div>

      {/* Profile fields */}
      <div className="card space-y-4">
        <h2 className="font-semibold">Profile Details</h2>
        {error && <p className="text-red-400 text-sm bg-red-900/20 rounded px-3 py-2">{error}</p>}
        {success && <p className="text-green-400 text-sm bg-green-900/20 rounded px-3 py-2">{success}</p>}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Username</label>
            <input className="input" value={username} onChange={(e) => setUsername(e.target.value)}
              placeholder="my-username" />
            <p className="text-xs text-gray-500 mt-1">3–30 chars, letters/numbers/-/_</p>
          </div>
          <div>
            <label className="label">Display Name</label>
            <input className="input" value={displayName} onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Your Name" />
          </div>
        </div>

        <div>
          <label className="label">Bio</label>
          <textarea className="input min-h-[80px] resize-y" value={bio}
            onChange={(e) => setBio(e.target.value)} placeholder="Tell the community about yourself…" />
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="label">Website</label>
            <input className="input" value={website} onChange={(e) => setWebsite(e.target.value)}
              placeholder="https://…" />
          </div>
          <div>
            <label className="label">Twitter</label>
            <input className="input" value={twitter} onChange={(e) => setTwitter(e.target.value)}
              placeholder="@handle" />
          </div>
          <div>
            <label className="label">Discord</label>
            <input className="input" value={discord} onChange={(e) => setDiscord(e.target.value)}
              placeholder="user#0000" />
          </div>
        </div>

        <button onClick={handleSave} disabled={saving} className="btn-primary">
          {saving ? 'Saving…' : 'Save Profile'}
        </button>
      </div>

      {/* Linked wallets */}
      <div className="card space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Linked Wallets</h2>
        </div>

        <div className="space-y-2">
          {/* Primary wallet (auth key) */}
          <div className="flex items-center justify-between bg-gray-800 rounded-lg px-4 py-3">
            <div>
              <code className="text-xs text-avian-400 break-all">{address}</code>
              <p className="text-xs text-gray-500 mt-0.5">Auth wallet</p>
            </div>
            <span className="badge-active text-xs">Auth</span>
          </div>
          {/* Linked wallets */}
          {profile?.wallets.filter(w => w.address !== address).map((w) => (
            <div key={w.address} className="flex items-center justify-between bg-gray-800 rounded-lg px-4 py-3 gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <code className="text-xs text-gray-300 break-all">{w.address}</code>
                  {w.isPrimary && <span className="badge-active text-xs shrink-0">Display Primary</span>}
                </div>
                {editingLabel?.address === w.address ? (
                  <div className="flex items-center gap-2 mt-1">
                    <input
                      className="input text-xs py-0.5 flex-1"
                      value={editingLabel.value}
                      onChange={(e) => setEditingLabel({ address: w.address, value: e.target.value })}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveLabel(w.address, editingLabel.value);
                        if (e.key === 'Escape') setEditingLabel(null);
                      }}
                      placeholder="Add a label…"
                      autoFocus
                    />
                    <button onClick={() => handleSaveLabel(w.address, editingLabel.value)} className="text-xs text-avian-400 hover:text-avian-300">Save</button>
                    <button onClick={() => setEditingLabel(null)} className="text-xs text-gray-500 hover:text-gray-300">Cancel</button>
                  </div>
                ) : (
                  <button
                    onClick={() => setEditingLabel({ address: w.address, value: w.label ?? '' })}
                    className="block text-xs text-gray-500 hover:text-gray-300 mt-0.5 text-left"
                  >
                    {w.label ? w.label : <span className="italic">Add label…</span>}
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {!w.isPrimary && (
                  <button onClick={() => handleSetPrimary(w.address)} className="text-xs text-avian-400 hover:text-avian-300">
                    Set primary
                  </button>
                )}
                <button onClick={() => setUnlinkAddress(w.address)} className="text-xs text-red-400 hover:text-red-300">
                  Unlink
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Link new wallet */}
        {linkStep === 'idle' && (
          <div className="space-y-3 border-t border-gray-800 pt-4">
            <p className="text-sm text-gray-400 font-medium">Link another wallet</p>
            <div className="flex gap-2">
              <input className="input flex-1" placeholder="Avian address" value={linkAddress}
                onChange={(e) => setLinkAddress(e.target.value)} />
              <input className="input w-40" placeholder="Label (optional)" value={linkLabel}
                onChange={(e) => setLinkLabel(e.target.value)} />
              <button onClick={handleRequestLinkChallenge} disabled={linking || !linkAddress} className="btn-secondary shrink-0">
                {linking ? '…' : 'Get challenge'}
              </button>
            </div>
          </div>
        )}

        {linkStep === 'challenge' && (
          <div className="space-y-3 border-t border-gray-800 pt-4">
            <p className="text-sm font-medium">Sign this challenge with <code className="text-avian-400 text-xs">{linkAddress}</code>:</p>
            <div className="flex items-start gap-2">
              <code className="flex-1 block bg-gray-900 rounded px-3 py-2 text-xs break-all">{linkChallenge}</code>
              <CopyButton text={linkChallenge} />
            </div>
            <div className="space-y-1">
              <p className="text-xs text-gray-400">In Avian Core:</p>
              <div className="flex items-start gap-2">
                <code className="flex-1 bg-gray-900 px-3 py-2 rounded text-xs break-all">signmessage &quot;{linkAddress}&quot; &quot;{linkChallenge}&quot;</code>
                <CopyButton text={`signmessage "${linkAddress}" "${linkChallenge}"`} />
              </div>
            </div>
            <div className="flex gap-2">
              <input id="link-sig-input" className="input flex-1" placeholder="Paste signature here" />
              <button
                onClick={() => {
                  const val = (document.getElementById('link-sig-input') as HTMLInputElement)?.value.trim();
                  if (val) handleConfirmLink(val);
                }}
                disabled={linking}
                className="btn-primary shrink-0"
              >
                {linking ? '…' : 'Confirm'}
              </button>
              <button onClick={() => setLinkStep('idle')} className="btn-secondary shrink-0">Cancel</button>
            </div>
          </div>
        )}
      </div>

      {/* Collections */}
      {profile?.collections && profile.collections.length > 0 && (
        <div className="card space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">My Collections</h2>
            <Link href="/collections/create" className="btn-primary text-sm">+ New Collection</Link>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {profile.collections.map((c) => (
              <Link key={c.id} href={`/collections/${c.slug}`}
                className="flex items-center gap-3 bg-gray-800 rounded-lg px-3 py-2 hover:bg-gray-700 transition-colors">
                {c.avatarUrl ? (
                  <Image src={`${API_BASE}${c.avatarUrl}`} alt={c.name} width={36} height={36}
                    className="rounded-full object-cover shrink-0" />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-gray-600 shrink-0 flex items-center justify-center text-sm font-bold">
                    {c.name.charAt(0)}
                  </div>
                )}
                <span className="text-sm truncate">{c.name}</span>
                {c.isVerified && <CheckCircle2 className="w-3.5 h-3.5 text-avian-400 ml-auto shrink-0" />}
              </Link>
            ))}
          </div>
          <Link href="/collections/create" className="block text-center text-sm text-avian-400 hover:underline pt-1">
            + Create new collection
          </Link>
        </div>
      )}

      {profile?.collections.length === 0 && (
        <div className="card text-center py-8 flex flex-col items-center gap-3">
          <p className="text-gray-400">You haven&apos;t created any collections yet.</p>
          <Link href="/collections/create" className="btn-primary">Create a Collection</Link>
        </div>
      )}

      {unlinkAddress && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl p-6 w-full max-w-sm space-y-4">
            <h2 className="text-lg font-semibold text-white">Unlink wallet?</h2>
            <p className="text-sm text-gray-400 break-all">{unlinkAddress}</p>
            <p className="text-sm text-gray-500">This address will no longer be linked to your account.</p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setUnlinkAddress(null)}
                className="px-4 py-2 text-sm rounded-lg border border-gray-600 text-gray-300 hover:bg-gray-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleUnlink(unlinkAddress)}
                className="px-4 py-2 text-sm rounded-lg bg-red-600 hover:bg-red-700 text-white font-medium transition-colors"
              >
                Unlink
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
