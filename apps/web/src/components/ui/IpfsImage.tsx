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

// Index 0 is the local API cache — fast 404 if not cached, no timeout needed.
// Indices 1+ are public gateways with the 30s timeout.
const LOCAL_BASE = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1');

function getSources(hash: string): string[] {
  return [
    `${LOCAL_BASE}/assets/ipfs/${hash}`,
    `https://ipfs.avn.network/ipfs/${hash}`,
    `https://ipfs.io/ipfs/${hash}`,
    `https://cloudflare-ipfs.com/ipfs/${hash}`,
    `https://dweb.link/ipfs/${hash}`,
  ];
}

// Gateway fetch can take 20–30 s on first resolve
const GATEWAY_TIMEOUT_MS = 30_000;

export function IpfsImage({ hash, alt, className, expandable, contain }: Props) {
  const [sourceIndex, setSourceIndex] = useState(0);
  const [failed, setFailed] = useState(false);
  const [lightbox, setLightbox] = useState(false);
  const loadedRef = useRef(false);
  const indexRef = useRef(0);

  const sources = getSources(hash);

  useEffect(() => {
    indexRef.current = sourceIndex;
    loadedRef.current = false;

    // Index 0 is the local API — it either serves immediately or 404s fast.
    // No timeout needed; onError handles the fast fallback.
    if (sourceIndex === 0) return;

    const timer = setTimeout(() => {
      if (loadedRef.current) return;
      const next = indexRef.current + 1;
      if (next < sources.length) {
        setSourceIndex(next);
      } else {
        setFailed(true);
      }
    }, GATEWAY_TIMEOUT_MS);

    return () => clearTimeout(timer);
  }, [sourceIndex, sources.length]);

  function handleLoad() {
    loadedRef.current = true;
  }

  function handleError() {
    loadedRef.current = false;
    const next = indexRef.current + 1;
    if (next < sources.length) {
      setSourceIndex(next);
    } else {
      setFailed(true);
    }
  }

  if (failed) {
    return (
      <div className={`relative w-full aspect-square rounded-lg overflow-hidden bg-gray-800 flex items-center justify-center ${className ?? ''}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/unpinned.png" alt="Unpinned" className="w-full h-full object-contain p-2 opacity-70" />
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

  const src = sources[sourceIndex];

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
