import type { Metadata } from 'next';
import { api } from '@/lib/api';
import { notFound } from 'next/navigation';
import { ListingDetail } from './ListingDetail';

// Always fetch fresh data — listing and offer status change frequently
export const dynamic = 'force-dynamic';

const API_BASE = process.env['API_INTERNAL_URL'] ?? 'http://localhost:4000/api/v1';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  try {
    const listing = (await api.getListing(id)) as ListingData;
    const amount = listing.assetAmount === 1 ? '' : ` ×${listing.assetAmount}`;
    const title = `${listing.assetName}${amount} — ${listing.priceAvn.toLocaleString()} AVN`;
    const description = `Buy ${listing.assetName}${amount} on Avian Marketplace for ${listing.priceAvn.toLocaleString()} AVN. Non-custodial PSBT trade.`;
    const imageUrl = `${API_BASE}/assets/ipfs/`;

    // Fetch the asset to get its IPFS hash
    let ogImage: string | undefined;
    try {
      const asset = (await fetch(`${API_BASE}/assets/${encodeURIComponent(listing.assetName)}`).then((r) => r.json())) as { ipfsHash?: string | null };
      if (asset.ipfsHash) {
        ogImage = `${API_BASE}/assets/ipfs/${asset.ipfsHash}`;
      }
    } catch { /* no image */ }

    return {
      title,
      description,
      openGraph: {
        title,
        description,
        url: `/listings/${id}`,
        siteName: 'Avian Marketplace',
        ...(ogImage ? { images: [{ url: ogImage, width: 800, height: 800, alt: listing.assetName }] } : {}),
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
    return { title: 'Listing — Avian Marketplace' };
  }
}

export default async function ListingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let listing: ListingData;
  try {
    listing = (await api.getListing(id)) as ListingData;
  } catch {
    notFound();
  }

  const offers = (await api.getOffers(id).catch(() => [])) as OfferData[];

  return <ListingDetail listing={listing} offers={offers} />;
}

export interface ListingData {
  id: string;
  sellerAddress: string;
  sellerProfile: { username: string | null; displayName: string | null; avatarUrl: string | null } | null;
  assetName: string;
  assetAmount: number;
  priceAvn: number;
  status: 'ACTIVE' | 'SOLD' | 'CANCELLED' | 'EXPIRED';
  expiresAt: string | null;
  createdAt: string;
  psbtBase64: string;
}

export interface OfferData {
  id: string;
  buyerAddress: string;
  offeredPriceAvn: number;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'WITHDRAWN' | 'EXPIRED' | 'COMPLETED' | 'CANCELLED';
  createdAt: string;
}
