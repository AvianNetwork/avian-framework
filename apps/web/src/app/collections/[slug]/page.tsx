import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { api } from '@/lib/api';
import { CollectionDetail } from './CollectionDetail';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  try {
    const collection = (await api.getCollection(slug)) as CollectionData;
    const title = `${collection.name} — Avian Marketplace`;
    const description = collection.description ?? `Browse the ${collection.name} collection on Avian Marketplace.`;
    const ogImage = collection.bannerUrl ?? collection.avatarUrl ?? undefined;
    return {
      title,
      description,
      openGraph: {
        title,
        description,
        url: `/collections/${slug}`,
        siteName: 'Avian Marketplace',
        ...(ogImage ? { images: [{ url: ogImage, alt: collection.name }] } : {}),
        type: 'website',
      },
      twitter: {
        card: ogImage ? 'summary_large_image' : 'summary',
        title,
        description,
        ...(ogImage ? { images: [ogImage] } : {}),
      },
    };
  } catch {
    return { title: 'Collection — Avian Marketplace' };
  }
}

interface CollectionItem {
  collectionId: string;
  assetName: string;
  displayOrder: number;
  addedAt: string;
  asset: { name: string; hasIpfs: boolean; ipfsHash: string | null; amount: number; units: number };
}

export interface CollectionData {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  bannerUrl: string | null;
  avatarUrl: string | null;
  website: string | null;
  twitterHandle: string | null;
  discordHandle: string | null;
  royaltyPercent: number | null;
  isVerified: boolean;
  ownerAddress: string;
  createdAt: string;
  owner: { username: string | null; displayName: string | null; avatarUrl: string | null; address: string };
  items: CollectionItem[];
  _count: { items: number };
}

export default async function CollectionPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  let collection: CollectionData;
  try {
    collection = (await api.getCollection(slug)) as CollectionData;
  } catch {
    notFound();
  }
  return <CollectionDetail collection={collection} />;
}
