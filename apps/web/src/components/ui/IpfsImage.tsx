'use client';

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

interface Props {
  hash: string;
  alt: string;
  className?: string;
  expandable?: boolean;
  contain?: boolean;
}

// Tried in order — first one to succeed wins
const GATEWAYS = [
  'https://ipfs.io/ipfs/',
  'https://ipfs.avn.network/ipfs/',
  'https://cloudflare-ipfs.com/ipfs/',
  'https://dweb.link/ipfs/',
];

// IPFS content retrieval can take 20–30 s on first fetch
const GATEWAY_TIMEOUT_MS = 30_000;

export function IpfsImage({ hash, alt, className, expandable, contain }: Props) {
  const [gatewayIndex, setGatewayIndex] = useState(0);
  const [failed, setFailed] = useState(false);
  const [lightbox, setLightbox] = useState(false);
  // True once the current gateway image fires onLoad — prevents the timeout
  // from advancing the gateway after a successful (but slow) load.
  const loadedRef = useRef(false);
  // Stable ref so timeout callbacks always read the latest index — no stale closure.
  const indexRef = useRef(0);

  useEffect(() => {
    indexRef.current = gatewayIndex;
    loadedRef.current = false; // reset for this gateway attempt

    const timer = setTimeout(() => {
      if (loadedRef.current) return; // already loaded — do nothing
      const next = indexRef.current + 1;
      if (next < GATEWAYS.length) {
        setGatewayIndex(next);
      } else {
        setFailed(true);
      }
    }, GATEWAY_TIMEOUT_MS);

    return () => clearTimeout(timer);
  }, [gatewayIndex]);

  function handleLoad() {
    loadedRef.current = true;
  }

  function handleError() {
    loadedRef.current = false;
    const next = indexRef.current + 1;
    if (next < GATEWAYS.length) {
      setGatewayIndex(next);
    } else {
      setFailed(true);
    }
  }

  if (failed) {
    return (
      <div className={`relative w-full aspect-square rounded-lg overflow-hidden bg-gray-800 flex items-center justify-center ${className ?? ''}`}>
        <div className="flex flex-col items-center gap-2 text-gray-600">
          <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <span className="text-xs">No image</span>
        </div>
      </div>
    );
  }

  // Close lightbox on Escape key
  useEffect(() => {
    if (!lightbox) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setLightbox(false); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [lightbox]);

  // Prevent body scroll while lightbox is open
  useEffect(() => {
    if (lightbox) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [lightbox]);

  const src = `${GATEWAYS[gatewayIndex]}${hash}`;

  return (
    <>
      <div
        className={`relative w-full ${contain ? '' : 'aspect-square'} rounded-lg overflow-hidden bg-gray-800 ${expandable ? 'cursor-zoom-in' : ''} ${className ?? ''}`}
        onClick={expandable ? () => setLightbox(true) : undefined}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          key={src}
          src={src}
          alt={alt}
          onLoad={handleLoad}
          onError={handleError}
          className={`w-full h-full ${contain ? 'object-contain' : 'object-cover'}`}
        />
      </div>

      {lightbox && typeof window !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          onClick={() => setLightbox(false)}
        >
          {/* Stop propagation on the image itself so clicking it doesn't close */}
          <div className="relative max-w-3xl w-full" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setLightbox(false)}
              className="absolute -top-10 right-0 text-gray-400 hover:text-white transition-colors text-sm flex items-center gap-1"
              aria-label="Close"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
              Close
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={src}
              alt={alt}
              className="w-full h-auto rounded-xl shadow-2xl"
            />
            <p className="text-center text-gray-400 text-xs mt-3 break-all">{alt}</p>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
