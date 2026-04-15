import Link from 'next/link';
import Image from 'next/image';
import { CheckCircle2 } from 'lucide-react';
import { api } from '@/lib/api';
import { LikeButton } from '@/components/ui/LikeButton';

export const dynamic = 'force-dynamic';

interface Collection {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  avatarUrl: string | null;
  bannerUrl: string | null;
  isVerified: boolean;
  ownerAddress: string;
  owner: { username: string | null; displayName: string | null; avatarUrl: string | null };
  _count: { items: number };
}

const API_BASE = process.env['NEXT_PUBLIC_API_URL']?.replace('/api/v1', '') ?? 'http://localhost:4000';

export default async function CollectionsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; filter?: string }>;
}) {
  const { page = '1', filter = '' } = await searchParams;
  const result = (await api.getCollections(Number(page), filter)) as {
    data: Collection[]; total: number;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Collections</h1>
          <p className="text-gray-400 text-sm mt-1">{result.total} collections</p>
        </div>
        <Link href="/collections/create" className="btn-primary">+ New Collection</Link>
      </div>

      {result.data.length === 0 ? (
        <div className="card text-center py-16 text-gray-400">
          No collections yet. <Link href="/collections/create" className="text-avian-400 hover:underline">Create the first one.</Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {result.data.map((c) => (
            <div key={c.id} className="card hover:border-avian-500/40 transition-colors overflow-hidden p-0 relative">
              {/* Full-card link sits behind everything */}
              <Link href={`/collections/${c.slug}`} className="absolute inset-0 z-0" aria-label={c.name} />
              {/* Banner area */}
              <div className="relative h-28 bg-gray-800 pointer-events-none">
                {(c.bannerUrl ?? c.avatarUrl) && (
                  <Image src={`${API_BASE}${c.bannerUrl ?? c.avatarUrl}`} alt={c.name} fill className="object-cover" />
                )}
              </div>
              <div className="px-5 pt-4 pb-2 space-y-2 pointer-events-none">
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{c.name}</span>
                  {c.isVerified && <CheckCircle2 className="w-3.5 h-3.5 text-avian-400" />}
                </div>
                {c.description && (
                  <p className="text-xs text-gray-400 line-clamp-2">{c.description}</p>
                )}
              </div>
              <div className="px-5 pb-4 flex items-center justify-between text-xs text-gray-500 pt-1 relative z-10">
                <span>
                  {c._count.items} items · by{' '}
                  {c.owner.username ? (
                    <Link
                      href={`/users/${c.owner.username}`}
                      className="text-avian-400 hover:text-avian-300 transition-colors"
                    >
                      {c.owner.displayName ?? `@${c.owner.username}`}
                    </Link>
                  ) : (
                    <span>{c.ownerAddress.slice(0, 8)}…</span>
                  )}
                </span>
                <LikeButton type="collection" id={c.slug} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
