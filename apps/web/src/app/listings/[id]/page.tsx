import { api } from '@/lib/api';
import { notFound } from 'next/navigation';
import { ListingDetail } from './ListingDetail';

// Always fetch fresh data — listing and offer status change frequently
export const dynamic = 'force-dynamic';

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
