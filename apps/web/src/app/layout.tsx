import type { Metadata } from 'next';
import './globals.css';
import { WalletProvider } from '../context/WalletContext';
import { NavBar } from '../components/NavBar';
import { SyncBanner } from '../components/ui/SyncBanner';
import { Toaster } from '../components/ui/Toaster';

export const metadata: Metadata = {
  title: {
    default: 'Avian Marketplace',
    template: '%s | Avian Marketplace',
  },
  description: 'Non-custodial asset marketplace powered by Avian blockchain and PSBT',
  icons: { icon: '/avian-logo.png' },
  openGraph: {
    siteName: 'Avian Marketplace',
    type: 'website',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-gray-950 text-gray-100 min-h-screen font-sans antialiased">
        <WalletProvider>
          <NavBar />
          <SyncBanner />
          <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {children}
          </main>
          <footer className="border-t border-gray-800 mt-16 py-8 text-center text-gray-500 text-sm">
            Avian Network — non-custodial PSBT asset marketplace
          </footer>
          <Toaster />
        </WalletProvider>
      </body>
    </html>
  );
}

