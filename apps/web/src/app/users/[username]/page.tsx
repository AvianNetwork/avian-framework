import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { Globe, CheckCircle2 } from 'lucide-react';
import { api } from '@/lib/api';
import { formatDateShort } from '@/lib/format';
import { ProfileWalletsSection } from '@/components/profile/ProfileWalletsSection';
import { WatchButton } from '@/components/profile/WatchButton';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string }>;
}): Promise<Metadata> {
  const { username } = await params;
  try {
    const profile = (await api.getPublicProfile(username)) as PublicProfile;
    const name = profile.displayName ?? profile.username;
    const title = `${name} — Avian Marketplace`;
    const description = profile.bio ?? `View ${name}'s listings, collections, and trade history on Avian Marketplace.`;
    const ogImage = profile.bannerUrl ?? profile.avatarUrl ?? undefined;
    return {
      title,
      description,
      openGraph: {
        title,
        description,
        url: `/users/${username}`,
        siteName: 'Avian Marketplace',
        ...(ogImage ? { images: [{ url: ogImage, alt: name }] } : {}),
        type: 'profile',
      },
      twitter: {
        card: ogImage ? 'summary_large_image' : 'summary',
        title,
        description,
        ...(ogImage ? { images: [ogImage] } : {}),
      },
    };
  } catch {
    return { title: `${username} — Avian Marketplace` };
  }
}

interface PublicProfile {
  id: string;
  address: string;
  username: string;
  displayName: string | null;
  bio: string | null;
  avatarUrl: string | null;
  bannerUrl: string | null;
  bannerPosition: string | null;
  website: string | null;
  twitterHandle: string | null;
  discordHandle: string | null;
  createdAt: string;
  wallets: { address: string; label: string | null; isPrimary: boolean }[];
  collections: {
    id: string; slug: string; name: string;
    avatarUrl: string | null; isVerified: boolean; description: string | null;
  }[];
}

interface ListingCard {
  id: string;
  assetName: string;
  assetAmount: number;
  priceAvn: number;
  createdAt: string;
  asset?: { ipfsHash: string | null; hasIpfs: boolean } | null;
}

interface SaleCard {
  id: string;
  assetName: string;
  priceAvn: number;
  soldPrice: number;
  role: 'sold' | 'bought';
  updatedAt: string;
  asset?: { ipfsHash: string | null; hasIpfs: boolean } | null;
}

const API_BASE = process.env['NEXT_PUBLIC_API_URL']?.replace('/api/v1', '') ?? 'http://localhost:4000';

export default async function UserProfilePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  let profile: PublicProfile;
  try {
    profile = (await api.getPublicProfile(username)) as PublicProfile;
  } catch {
    notFound();
  }

  // Fetch active listings for all addresses associated with this user
  const allAddresses = [profile.address, ...profile.wallets.map((w) => w.address)];
  const [listingResults, saleResults] = await Promise.all([
    Promise.all(allAddresses.map((addr) =>
      api.getListingsBySeller(addr).catch(() => ({ data: [], total: 0 }))
    )),
    Promise.all(allAddresses.map((addr) =>
      api.getSaleHistory(addr).catch(() => ({ data: [], total: 0 }))
    )),
  ]);
  const listings = listingResults
    .flatMap((r) => (r as { data: ListingCard[] }).data)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  // Deduplicate sales (same listing can appear for multiple addresses if buyer+seller are both linked)
  const seenSaleIds = new Set<string>();
  const sales = saleResults
    .flatMap((r) => (r as { data: SaleCard[] }).data)
    .filter((s) => { if (seenSaleIds.has(s.id)) return false; seenSaleIds.add(s.id); return true; })
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 12);

  const hasSocials = profile.website || profile.twitterHandle || profile.discordHandle;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Banner */}
      <div className="relative h-52 rounded-2xl overflow-hidden bg-gray-800">
        {profile.bannerUrl ? (
          <Image src={`${API_BASE}${profile.bannerUrl}`} alt="Banner" fill className="object-cover"
            style={{ objectPosition: profile.bannerPosition ?? '50% 50%' }} />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-gray-800 to-gray-900" />
        )}
      </div>

      {/* Profile header card */}
      <div className="card -mt-16 pt-0 overflow-visible">
        {/* Avatar row */}
        <div className="flex items-end gap-4 -mt-12 mb-4 px-1">
          <div className="relative w-24 h-24 rounded-full border-4 border-gray-900 overflow-hidden bg-gray-700 shrink-0 shadow-lg">
            {profile.avatarUrl ? (
              <Image src={`${API_BASE}${profile.avatarUrl}`} alt={profile.username} fill className="object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-3xl font-bold text-gray-400">
                {profile.username.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
          <div className="pb-1 flex-1 min-w-0 pt-8">
            <h1 className="text-2xl font-bold leading-tight truncate">
              {profile.displayName ?? profile.username}
            </h1>
            <p className="text-gray-400 text-sm">@{profile.username}</p>
          </div>
          <div className="flex items-end gap-3 pb-1 shrink-0">
            <WatchButton profileAddress={profile.address} />
            <p className="text-xs text-gray-600">
              Member since {formatDateShort(profile.createdAt)}
            </p>
          </div>
        </div>

        {/* Bio */}
        {profile.bio && (
          <p className="text-gray-300 text-sm leading-relaxed mb-4 border-t border-gray-800 pt-4">
            {profile.bio}
          </p>
        )}

        {/* Social links */}
        {hasSocials && (
          <div className={`flex flex-wrap gap-4 ${profile.bio ? '' : 'border-t border-gray-800 pt-4'}`}>
            {profile.website && (
              <a href={profile.website} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs text-avian-400 hover:text-avian-300 transition-colors">
                <Globe className="w-3.5 h-3.5" />
                <span>{profile.website.replace(/^https?:\/\//, '')}</span>
              </a>
            )}
            {profile.twitterHandle && (
              <a href={`https://x.com/${profile.twitterHandle.replace('@', '')}`}
                target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs text-avian-400 hover:text-avian-300 transition-colors">
                <span>𝕏</span>
                <span>{profile.twitterHandle}</span>
              </a>
            )}
            {profile.discordHandle && (
              <a href={`https://discord.com/users/${profile.discordHandle}`}
                target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 transition-colors">
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057c.003.028.015.056.036.074a19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z" />
                </svg>
                <span>{profile.discordHandle}</span>
              </a>
            )}
          </div>
        )}
      </div>

      {/* Linked wallets — only visible to owner (client-side check) */}
      <ProfileWalletsSection
        primaryAddress={profile.address}
        wallets={profile.wallets}
      />

      {/* Active Listings */}
      {listings.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-lg">Active Listings</h2>
            <span className="text-sm text-gray-500">{listings.length} listing{listings.length !== 1 ? 's' : ''}</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {listings.map((l) => (
              <Link
                key={l.id}
                href={`/listings/${l.id}`}
                className="card hover:border-avian-700 transition-colors block overflow-hidden p-0"
              >
                {l.asset?.hasIpfs && l.asset?.ipfsHash ? (
                  <div className="relative h-40 bg-gray-800">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`https://ipfs.io/ipfs/${l.asset.ipfsHash}`}
                      alt={l.assetName}
                      className="w-full h-full object-cover"
                    />
                  </div>
                ) : (
                  <div className="h-40 bg-gray-800 flex items-center justify-center">
                    <svg className="w-10 h-10 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                )}
                <div className="p-4">
                  <p className="font-medium text-sm truncate">{l.assetName}</p>
                  <p className="text-avian-400 font-bold mt-1">
                    {l.priceAvn} <span className="text-xs font-normal text-gray-400">AVN</span>
                  </p>
                  <p className="text-xs text-gray-500 mt-1">{formatDateShort(l.createdAt)}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Sale History */}
      {sales.length > 0 && (
        <div className="space-y-4">
          <h2 className="font-semibold text-lg">Sale History</h2>
          <div className="card overflow-hidden p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800 text-left text-xs text-gray-500 uppercase tracking-wide">
                  <th className="px-4 py-3">Asset</th>
                  <th className="px-4 py-3">Price</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3 text-right">Date</th>
                </tr>
              </thead>
              <tbody>
                {sales.map((s) => (
                  <tr key={s.id} className="border-b border-gray-800/50 last:border-0 hover:bg-gray-800/30 transition-colors">
                    <td className="px-4 py-3">
                      <Link href={`/listings/${s.id}`} className="font-medium text-white hover:text-avian-400 transition-colors">
                        {s.assetName}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-avian-400 font-semibold">
                      {Number(s.soldPrice).toFixed(2)} <span className="text-xs font-normal text-gray-400">AVN</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${s.role === 'sold' ? 'bg-emerald-900/50 text-emerald-400' : 'bg-blue-900/50 text-blue-400'}`}>
                        {s.role === 'sold' ? 'Sold' : 'Bought'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-gray-500">{formatDateShort(s.updatedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Collections */}
      {profile.collections.length > 0 && (
        <div className="space-y-4">
          <h2 className="font-semibold text-lg">Collections</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {profile.collections.map((c) => (
              <Link key={c.id} href={`/collections/${c.slug}`}
                className="card hover:border-avian-500/40 transition-colors">
                {c.avatarUrl ? (
                  <div className="relative h-24 -mx-5 -mt-5 rounded-t-2xl overflow-hidden mb-3">
                    <Image src={`${API_BASE}${c.avatarUrl}`} alt={c.name} fill className="object-cover" />
                  </div>
                ) : (
                  <div className="h-24 -mx-5 -mt-5 rounded-t-2xl bg-gray-700 mb-3" />
                )}
                <div className="flex items-center gap-1">
                  <span className="font-medium text-sm truncate">{c.name}</span>
                  {c.isVerified && <CheckCircle2 className="w-3.5 h-3.5 text-avian-400" />}
                </div>
                {c.description && <p className="text-xs text-gray-400 line-clamp-2 mt-1">{c.description}</p>}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
