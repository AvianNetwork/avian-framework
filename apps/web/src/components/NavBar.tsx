'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { X } from 'lucide-react';
import { useWallet } from '../context/WalletContext';
import { NotificationBell } from './ui/NotificationBell';

export function NavBar() {
  const { address, isConnected, disconnect, knownAddresses, removeKnownAddress, switchTo, switchableAddresses, openConnectModal } = useWallet();
  const [showMenu, setShowMenu] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);

  const short = (addr: string) => `${addr.slice(0, 6)}…${addr.slice(-4)}`;

  function openSwitch(prefill?: string) {
    if (prefill && switchTo(prefill)) {
      setShowMenu(false);
      return;
    }
    openConnectModal(prefill);
    setShowMenu(false);
    setShowMobileMenu(false);
  }

  const otherAddresses = switchableAddresses;

  const navLinks = (
    <>
      <a href="/marketplace" className="hover:text-white transition-colors">Marketplace</a>
      <a href="/activity" className="hover:text-white transition-colors">Activity</a>
      <a href="/assets" className="hover:text-white transition-colors">Assets</a>
      <a href="/collections" className="hover:text-white transition-colors">Collections</a>
      {isConnected && <a href="/trades" className="hover:text-white transition-colors">Trades</a>}
      {isConnected && <a href="/offers" className="hover:text-white transition-colors">My Offers</a>}
      {isConnected && <a href="/blind-offers" className="hover:text-white transition-colors">Blind Offers</a>}
      {isConnected && <a href="/blind-offers/received" className="hover:text-white transition-colors">Received</a>}
    </>
  );

  return (
    <>
      <header className="border-b border-gray-800 bg-gray-900/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 font-bold text-xl text-avian-400 shrink-0">
            <Image src="/avian-logo.png" alt="Avian" width={28} height={28} />
            <span className="hidden sm:inline">Avian Marketplace</span>
            <span className="sm:hidden">Avian</span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-6 text-sm text-gray-400">
            {navLinks}
          </nav>

          {/* Right side: wallet + notifications + hamburger */}
          <div className="flex items-center gap-2">
            <NotificationBell />
            {isConnected ? (
              <div className="relative">
                <button
                  onClick={() => setShowMenu((v) => !v)}
                  className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-sm text-gray-200 font-medium px-3 py-2 rounded-lg transition-colors"
                >
                  <span className="w-2 h-2 rounded-full bg-green-400 inline-block" />
                  <span className="hidden sm:inline">{address && short(address)}</span>
                  <span className="text-gray-500">▾</span>
                </button>
                {showMenu && (
                  <div className="absolute right-0 mt-1 w-56 bg-gray-800 border border-gray-700 rounded-lg shadow-xl overflow-hidden z-50">
                    <div className="px-3 py-2 text-xs text-gray-500 border-b border-gray-700 break-all">
                      {address}
                    </div>
                    <a
                      href="/listings/create"
                      onClick={() => setShowMenu(false)}
                      className="block px-3 py-2 text-sm text-gray-300 hover:bg-gray-700 transition-colors"
                    >
                      + Create Listing
                    </a>
                    <a
                      href="/profile"
                      onClick={() => setShowMenu(false)}
                      className="block px-3 py-2 text-sm text-gray-300 hover:bg-gray-700 transition-colors"
                    >
                      My Profile
                    </a>
                    {otherAddresses.length > 0 && (
                      <>
                        <div className="px-3 pt-2 pb-1 text-xs text-gray-500 uppercase tracking-wide border-t border-gray-700">
                          Switch Address
                        </div>
                        {otherAddresses.map((addr) => (
                          <div key={addr} className="flex items-center group">
                            <button
                              onClick={() => openSwitch(addr)}
                              className="flex-1 text-left px-3 py-2 text-sm text-gray-300 hover:bg-gray-700 transition-colors font-mono"
                              title={addr}
                            >
                              {short(addr)}
                            </button>
                            <button
                              onClick={() => removeKnownAddress(addr)}
                              className="px-2 py-2 text-gray-600 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                              title="Remove"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </>
                    )}
                    <div className="border-t border-gray-700">
                      <button
                        onClick={() => { disconnect(); setShowMenu(false); }}
                        className="w-full text-left px-3 py-2 text-sm text-red-400 hover:bg-gray-700 transition-colors"
                      >
                        Disconnect
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <button
                onClick={() => openSwitch()}
                className="bg-avian-600 hover:bg-avian-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
              >
                Connect Wallet
              </button>
            )}

            {/* Hamburger — mobile only */}
            <button
              onClick={() => setShowMobileMenu((v) => !v)}
              className="md:hidden flex flex-col justify-center items-center w-9 h-9 gap-1.5 rounded-lg hover:bg-gray-800 transition-colors"
              aria-label="Toggle menu"
            >
              <span className={`block w-5 h-0.5 bg-gray-400 transition-transform origin-center ${showMobileMenu ? 'rotate-45 translate-y-2' : ''}`} />
              <span className={`block w-5 h-0.5 bg-gray-400 transition-opacity ${showMobileMenu ? 'opacity-0' : ''}`} />
              <span className={`block w-5 h-0.5 bg-gray-400 transition-transform origin-center ${showMobileMenu ? '-rotate-45 -translate-y-2' : ''}`} />
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {showMobileMenu && (
          <div className="md:hidden border-t border-gray-800 bg-gray-900 px-4 py-3 flex flex-col gap-1 text-sm text-gray-400">
            <a href="/marketplace" onClick={() => setShowMobileMenu(false)} className="py-2 hover:text-white transition-colors">Marketplace</a>
            <a href="/activity" onClick={() => setShowMobileMenu(false)} className="py-2 hover:text-white transition-colors">Activity</a>
            <a href="/assets" onClick={() => setShowMobileMenu(false)} className="py-2 hover:text-white transition-colors">Assets</a>
            <a href="/collections" onClick={() => setShowMobileMenu(false)} className="py-2 hover:text-white transition-colors">Collections</a>
            {isConnected && (
              <>
                <div className="border-t border-gray-800 my-1" />
                <a href="/trades" onClick={() => setShowMobileMenu(false)} className="py-2 hover:text-white transition-colors">Trades</a>
                <a href="/offers" onClick={() => setShowMobileMenu(false)} className="py-2 hover:text-white transition-colors">My Offers</a>
                <a href="/blind-offers" onClick={() => setShowMobileMenu(false)} className="py-2 hover:text-white transition-colors">Blind Offers</a>
                <a href="/blind-offers/received" onClick={() => setShowMobileMenu(false)} className="py-2 hover:text-white transition-colors">Received</a>
                <div className="border-t border-gray-800 my-1" />
                <a href="/listings/create" onClick={() => setShowMobileMenu(false)} className="py-2 hover:text-white transition-colors">+ Create Listing</a>
                <a href="/profile" onClick={() => setShowMobileMenu(false)} className="py-2 hover:text-white transition-colors">My Profile</a>
              </>
            )}
          </div>
        )}
      </header>

    </>
  );
}
