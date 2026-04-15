'use client';

import { useWallet } from '@/context/WalletContext';

interface Wallet {
  address: string;
  label: string | null;
  isPrimary: boolean;
}

interface Props {
  primaryAddress: string;
  wallets: Wallet[];
}

export function ProfileWalletsSection({ primaryAddress, wallets }: Props) {
  const { address: myAddress } = useWallet();

  // Only show wallets to the profile owner
  const profileAddresses = [primaryAddress, ...wallets.map((w) => w.address)];
  const isOwner = myAddress && profileAddresses.includes(myAddress);

  if (!isOwner) return null;

  const allWallets = [
    { address: primaryAddress, label: null, isPrimary: false, isAuth: true },
    ...wallets.filter((w) => w.address !== primaryAddress).map((w) => ({
      address: w.address,
      label: w.label ?? null,
      isPrimary: w.isPrimary,
      isAuth: false,
    })),
  ];

  return (
    <div className="card space-y-3">
      <h2 className="font-semibold text-sm text-gray-400 uppercase tracking-wide">
        Linked Wallets
      </h2>
      <div className="space-y-1.5">
        {allWallets.map((w) => (
          <div key={w.address} className="flex items-center gap-2">
            <code className="text-xs text-avian-400 break-all">{w.address}</code>
            {w.isAuth && <span className="text-xs text-gray-500 shrink-0">Auth</span>}
            {w.isPrimary && <span className="text-xs text-avian-400 shrink-0">Display Primary</span>}
            {w.label && <span className="text-xs text-gray-500 shrink-0">{w.label}</span>}
          </div>
        ))}
      </div>
    </div>
  );
}
