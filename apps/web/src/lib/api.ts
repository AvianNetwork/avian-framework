// Server-side fetches use the internal Docker network URL (API_INTERNAL_URL).
// Client-side fetches use the public URL baked in at build time (NEXT_PUBLIC_API_URL).
const API_BASE =
  (typeof window === 'undefined'
    ? process.env['API_INTERNAL_URL']
    : process.env['NEXT_PUBLIC_API_URL']) ?? 'http://localhost:4000/api/v1';

async function apiFetch<T>(
  path: string,
  options?: RequestInit & { token?: string }
): Promise<T> {
  const isFormData = options?.body instanceof FormData;
  const headers: Record<string, string> = {
    // Don't set Content-Type for FormData — browser sets it with boundary
    ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
    ...(options?.token ? { Authorization: `Bearer ${options.token}` } : {}),
  };

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error((err as { message?: string }).message ?? 'API error');
  }
  if (res.status === 204 || res.headers.get('content-length') === '0') {
    return undefined as T;
  }
  return res.json() as Promise<T>;
}

export const api = {
  // Auth
  challenge: (address: string) =>
    apiFetch<{ challenge: string; expiresAt: string }>('/auth/challenge', {
      method: 'POST',
      body: JSON.stringify({ address }),
    }),
  verify: (address: string, challenge: string, signature: string) =>
    apiFetch<{ token: string; expiresAt: string }>('/auth/verify', {
      method: 'POST',
      body: JSON.stringify({ address, challenge, signature }),
    }),

  // Assets
  listAssets: (filter?: string, page = 1) =>
    apiFetch<{ data: unknown[]; total: number; page: number }>(`/assets?filter=${encodeURIComponent(filter ?? '')}&page=${page}&hasIpfs=true`),
  getAsset: (name: string) =>
    apiFetch<unknown>(`/assets/${encodeURIComponent(name)}`),
  getBalances: (address: string) =>
    apiFetch<Record<string, number>>(`/assets/address/${address}`),

  // Listings
  getListings: (params?: { asset?: string; page?: number; minPrice?: number; maxPrice?: number; sort?: string }) => {
    const p = params ?? {};
    const qs = new URLSearchParams();
    if (p.asset) qs.set('asset', p.asset);
    if (p.page) qs.set('page', String(p.page));
    if (p.minPrice != null) qs.set('minPrice', String(p.minPrice));
    if (p.maxPrice != null) qs.set('maxPrice', String(p.maxPrice));
    if (p.sort) qs.set('sort', p.sort);
    const query = qs.toString();
    return apiFetch<{ data: unknown[]; total: number }>(`/listings${query ? `?${query}` : ''}`);
  },
  getMarketplaceStats: (asset?: string) =>
    apiFetch<{ activeListings: number; totalSales: number; volume: number; floorPrice: number | null; lastSale: number | null; lastSaleAt: string | null }>(
      `/listings/stats${asset ? `?asset=${encodeURIComponent(asset)}` : ''}`
    ),
  getListingsBySeller: (address: string) =>
    apiFetch<{ data: unknown[]; total: number }>(`/listings?seller=${encodeURIComponent(address)}&pageSize=12`),
  getSaleHistory: (address: string, page = 1) =>
    apiFetch<{ data: unknown[]; total: number }>(`/listings/sales/by-address?address=${encodeURIComponent(address)}&page=${page}&pageSize=20`),
  getListing: (id: string) =>
    apiFetch<unknown>(`/listings/${id}`),
  createListing: (dto: unknown, token: string) =>
    apiFetch<unknown>('/listings', { method: 'POST', body: JSON.stringify(dto), token }),
  cancelListing: (id: string, token: string) =>
    apiFetch<unknown>(`/listings/${id}/cancel`, { method: 'PATCH', token }),

  // Offers
  getOffers: (listingId: string) =>
    apiFetch<unknown[]>(`/offers/listing/${listingId}`),
  getMyOffers: (token: string) =>
    apiFetch<unknown[]>('/offers/my', { token }),
  getOfferFundingInfo: (id: string, token: string) =>
    apiFetch<{
      sellerInputTxid: string;
      sellerInputVout: number;
      sellerInputSequence: number;
      sellerAddress: string;
      priceAvn: number;
      assetName: string;
      assetAmount: number;
    }>(`/offers/${id}/funding-info`, { token }),
  createOffer: (dto: unknown, token: string) =>
    apiFetch<unknown>('/offers', { method: 'POST', body: JSON.stringify(dto), token }),
  acceptOffer: (id: string, token: string) =>
    apiFetch<unknown>(`/offers/${id}/accept`, { method: 'PATCH', token }),
  rejectOffer: (id: string, token: string) =>
    apiFetch<unknown>(`/offers/${id}/reject`, { method: 'PATCH', token }),
  withdrawOffer: (id: string, token: string) =>
    apiFetch<unknown>(`/offers/${id}/withdraw`, { method: 'PATCH', token }),
  combineOfferPsbt: (id: string, buyerFundingPsbt: string, token: string) =>
    apiFetch<{ combinedPsbt: string }>(`/offers/${id}/combine-psbt`, {
      method: 'POST',
      body: JSON.stringify({ buyerFundingPsbt }),
      token,
    }),
  completeOffer: (id: string, signedPsbt: string, token: string) =>
    apiFetch<{ txid: string }>(`/offers/${id}/complete`, {
      method: 'POST',
      body: JSON.stringify({ signedPsbt }),
      token,
    }),

  // PSBT
  buildListingPsbt: (dto: unknown, token: string) =>
    apiFetch<{ psbtBase64: string; decoded: unknown }>('/psbt/build/listing', {
      method: 'POST',
      body: JSON.stringify(dto),
      token,
    }),
  decodePsbt: (psbtBase64: string) =>
    apiFetch<{ decoded: unknown; analyzed: unknown }>('/psbt/decode', {
      method: 'POST',
      body: JSON.stringify({ psbtBase64 }),
    }),
  submitSignedPsbt: (dto: unknown, token: string) =>
    apiFetch<{ txid: string }>('/psbt/submit', {
      method: 'POST',
      body: JSON.stringify(dto),
      token,
    }),

  // Blind Offers
  createBlindOffer: (dto: unknown, token: string) =>
    apiFetch<unknown>('/blind-offers', { method: 'POST', body: JSON.stringify(dto), token }),
  getMyBlindOffers: (token: string) =>
    apiFetch<unknown[]>('/blind-offers/my', { token }),
  getReceivedBlindOffers: (token: string) =>
    apiFetch<unknown[]>('/blind-offers/received', { token }),
  getBlindOffersByAsset: (assetName: string) =>
    apiFetch<unknown[]>(`/blind-offers/asset/${encodeURIComponent(assetName)}`),
  withdrawBlindOffer: (id: string, token: string) =>
    apiFetch<unknown>(`/blind-offers/${id}/withdraw`, { method: 'PATCH', token }),
  deleteBlindOffer: (id: string, token: string) =>
    apiFetch<void>(`/blind-offers/${id}`, { method: 'DELETE', token }),
  rejectBlindOffer: (id: string, token: string) =>
    apiFetch<unknown>(`/blind-offers/${id}/reject`, { method: 'PATCH', token }),
  acceptBlindOffer: (id: string, psbtBase64: string, token: string) =>
    apiFetch<{ offerId: string; listingId: string }>(`/blind-offers/${id}/accept`, {
      method: 'POST',
      body: JSON.stringify({ psbtBase64 }),
      token,
    }),

  // Profile
  getMyProfile: (token: string) =>
    apiFetch<unknown>('/profile/me', { token }),
  updateProfile: (dto: unknown, token: string) =>
    apiFetch<unknown>('/profile/me', { method: 'PATCH', body: JSON.stringify(dto), token }),
  getPublicProfile: (username: string) =>
    apiFetch<unknown>(`/profile/${encodeURIComponent(username)}`),
  issueLinkChallenge: (newAddress: string, token: string) =>
    apiFetch<{ challenge: string; expiresAt: string }>('/profile/wallets/challenge', {
      method: 'POST',
      body: JSON.stringify({ newAddress }),
      token,
    }),
  linkWallet: (dto: { newAddress: string; challenge: string; signature: string; label?: string }, token: string) =>
    apiFetch<unknown>('/profile/wallets', { method: 'POST', body: JSON.stringify(dto), token }),
  unlinkWallet: (address: string, token: string) =>
    apiFetch<unknown>(`/profile/wallets/${encodeURIComponent(address)}`, { method: 'DELETE', token }),
  updateWalletLabel: (address: string, label: string | null, token: string) =>
    apiFetch<unknown>(`/profile/wallets/${encodeURIComponent(address)}`, { method: 'PATCH', body: JSON.stringify({ label }), token }),
  setDisplayPrimary: (address: string, token: string) =>
    apiFetch<unknown>(`/profile/wallets/${encodeURIComponent(address)}/primary`, { method: 'PATCH', token }),
  uploadProfileAvatar: (file: File, token: string) => {
    const form = new FormData(); form.append('file', file);
    return apiFetch<unknown>('/profile/me/avatar', { method: 'POST', body: form, token });
  },
  uploadProfileBanner: (file: File, token: string) => {
    const form = new FormData(); form.append('file', file);
    return apiFetch<unknown>('/profile/me/banner', { method: 'POST', body: form, token });
  },

  // Collections
  getCollections: (page = 1, filter?: string) =>
    apiFetch<{ data: unknown[]; total: number }>(`/collections?page=${page}&filter=${filter ?? ''}`),
  getCollection: (slug: string) =>
    apiFetch<unknown>(`/collections/${encodeURIComponent(slug)}`),
  createCollection: (dto: unknown, token: string) =>
    apiFetch<unknown>('/collections', { method: 'POST', body: JSON.stringify(dto), token }),
  updateCollection: (slug: string, dto: unknown, token: string) =>
    apiFetch<unknown>(`/collections/${encodeURIComponent(slug)}`, { method: 'PATCH', body: JSON.stringify(dto), token }),
  deleteCollection: (slug: string, token: string) =>
    apiFetch<void>(`/collections/${encodeURIComponent(slug)}`, { method: 'DELETE', token }),
  addCollectionItem: (slug: string, assetName: string, token: string) =>
    apiFetch<unknown>(`/collections/${encodeURIComponent(slug)}/items`, {
      method: 'POST', body: JSON.stringify({ assetName }), token,
    }),
  removeCollectionItem: (slug: string, assetName: string, token: string) =>
    apiFetch<void>(`/collections/${encodeURIComponent(slug)}/items/${encodeURIComponent(assetName)}`, {
      method: 'DELETE', token,
    }),
  uploadCollectionAvatar: (slug: string, file: File, token: string) => {
    const form = new FormData(); form.append('file', file);
    return apiFetch<unknown>(`/collections/${encodeURIComponent(slug)}/avatar`, { method: 'POST', body: form, token });
  },
  uploadCollectionBanner: (slug: string, file: File, token: string) => {
    const form = new FormData(); form.append('file', file);
    return apiFetch<unknown>(`/collections/${encodeURIComponent(slug)}/banner`, { method: 'POST', body: form, token });
  },

  // Asset Metadata
  getAssetMetadata: (name: string) =>
    apiFetch<unknown>(`/assets/${encodeURIComponent(name)}/metadata`),
  setAssetMetadata: (
    name: string,
    dto: { title?: string; description?: string; externalUrl?: string; traits?: unknown[] },
    token: string
  ) =>
    apiFetch<unknown>(`/assets/${encodeURIComponent(name)}/metadata`, {
      method: 'PUT', body: JSON.stringify(dto), token,
    }),
  getHolderNote: (name: string, token: string) =>
    apiFetch<unknown>(`/assets/${encodeURIComponent(name)}/note`, { token }),
  setHolderNote: (name: string, note: string, token: string) =>
    apiFetch<unknown>(`/assets/${encodeURIComponent(name)}/note`, {
      method: 'PUT', body: JSON.stringify({ note }), token,
    }),
  getHolderMetadata: (name: string, address: string) =>
    apiFetch<unknown>(`/assets/${encodeURIComponent(name)}/holder-metadata/${encodeURIComponent(address)}`),
  setHolderMetadata: (
    name: string,
    dto: { title?: string; description?: string; externalUrl?: string; traits?: unknown[] },
    token: string
  ) =>
    apiFetch<unknown>(`/assets/${encodeURIComponent(name)}/holder-metadata`, {
      method: 'PUT', body: JSON.stringify(dto), token,
    }),

  // ─── Likes ───────────────────────────────────────────────────────────────
  getLikes: (type: 'asset' | 'collection', id: string, address?: string) => {
    const qs = address ? `?address=${encodeURIComponent(address)}` : '';
    return apiFetch<{ count: number; liked: boolean }>(`/likes/${type}/${encodeURIComponent(id)}${qs}`);
  },
  toggleLike: (type: 'asset' | 'collection', id: string, token: string) =>
    apiFetch<{ count: number; liked: boolean }>(`/likes/${type}/${encodeURIComponent(id)}`, {
      method: 'POST', token,
    }),

  // ─── Notifications ───────────────────────────────────────────────────────
  getNotifications: (token: string) =>
    apiFetch<{ id: string; type: string; title: string; body: string; link: string | null; read: boolean; createdAt: string }[]>(
      '/notifications', { token }
    ),
  getUnreadCount: (token: string) =>
    apiFetch<{ count: number }>('/notifications/unread-count', { token }),
  markNotificationRead: (id: string, token: string) =>
    apiFetch<unknown>(`/notifications/${encodeURIComponent(id)}/read`, { method: 'PATCH', token }),
  markAllNotificationsRead: (token: string) =>
    apiFetch<unknown>('/notifications/read-all', { method: 'PATCH', token }),
  deleteNotification: (id: string, token: string) =>
    apiFetch<unknown>(`/notifications/${encodeURIComponent(id)}`, { method: 'DELETE', token }),
  deleteAllNotifications: (token: string) =>
    apiFetch<unknown>('/notifications', { method: 'DELETE', token }),

  // ─── Watches ─────────────────────────────────────────────────────────────
  watchUser: (address: string, token: string) =>
    apiFetch<void>(`/watches/${encodeURIComponent(address)}`, { method: 'POST', token }),
  unwatchUser: (address: string, token: string) =>
    apiFetch<void>(`/watches/${encodeURIComponent(address)}`, { method: 'DELETE', token }),
  getWatchStatus: (address: string, token: string) =>
    apiFetch<{ watching: boolean }>(`/watches/status/${encodeURIComponent(address)}`, { token }),
};


