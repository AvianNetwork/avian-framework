'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Gift, Lock, Check, PartyPopper } from 'lucide-react';
import { useWallet } from '@/context/WalletContext';
import { api } from '@/lib/api';
import { CopyButton } from '@/components/ui/CopyButton';

type Step = 'form' | 'sign' | 'submit' | 'done';

interface FormData {
  assetName: string;
  assetAmount: string;
  recipientAddress: string;
}

export default function GiftPage() {
  return (
    <Suspense>
      <GiftForm />
    </Suspense>
  );
}

function GiftForm() {
  const { address, token, isConnected, linkedAddresses } = useWallet();
  const searchParams = useSearchParams();
  const [step, setStep] = useState<Step>('form');
  const [form, setForm] = useState<FormData>(() => ({
    assetName: searchParams.get('asset') ?? '',
    assetAmount: '1',
    recipientAddress: '',
  }));
  const [senderAddress, setSenderAddress] = useState<string | null>(null);
  const [addressBalances, setAddressBalances] = useState<Record<string, number>>({});
  const [psbtBase64, setPsbtBase64] = useState('');
  const [signedPsbt, setSignedPsbt] = useState('');
  const [txid, setTxid] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Auto-detect which address holds the asset
  useEffect(() => {
    const prefilledAsset = searchParams.get('asset');
    if (prefilledAsset && address) fetchBalance(prefilledAsset);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address]);

  async function fetchBalance(assetName: string) {
    if (!address || !assetName.trim()) return;
    const name = assetName.trim();
    const allAddresses = linkedAddresses.length > 0 ? linkedAddresses : [address];
    try {
      const results = await Promise.all(
        allAddresses.map((addr) => api.getBalances(addr).catch(() => ({} as Record<string, number>)))
      );
      const balMap: Record<string, number> = {};
      for (let i = 0; i < allAddresses.length; i++) {
        const bal = results[i]?.[name] ?? 0;
        if (bal > 0) balMap[allAddresses[i]!] = bal;
      }
      setAddressBalances(balMap);
      const owningAddrs = Object.keys(balMap);
      if (owningAddrs.length > 0) {
        setSenderAddress(owningAddrs.includes(address) ? address : owningAddrs[0]!);
      } else {
        setSenderAddress(address);
      }
    } catch {
      // address index may not be enabled
    }
  }

  if (!isConnected) {
    return (
      <div className="max-w-lg mx-auto text-center py-24 space-y-4">
        <Lock className="w-12 h-12 text-gray-500 mx-auto" />
        <h1 className="text-2xl font-bold">Connect your wallet to continue</h1>
        <p className="text-gray-400">You need to connect your Avian wallet before gifting an asset.</p>
      </div>
    );
  }

  async function handleBuild() {
    setError('');
    if (!form.assetName.trim()) { setError('Please enter the asset name.'); return; }
    if (!form.recipientAddress.trim()) { setError('Please enter the recipient address.'); return; }
    if (!form.assetAmount || Number(form.assetAmount) <= 0) { setError('Please enter a valid amount.'); return; }
    if (form.recipientAddress.trim() === (senderAddress ?? address)) {
      setError('You cannot gift an asset to yourself.');
      return;
    }

    // Auto-detect sender if not already set
    if (!senderAddress) {
      await fetchBalance(form.assetName.trim());
    }

    setLoading(true);
    try {
      const result = await api.buildGiftPsbt(
        {
          senderAddress: senderAddress ?? address!,
          recipientAddress: form.recipientAddress.trim(),
          assetName: form.assetName.trim(),
          assetAmount: Number(form.assetAmount),
        },
        token!
      );
      setPsbtBase64(result.psbtBase64);
      setStep('sign');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to build gift PSBT.');
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit() {
    setError('');
    if (!signedPsbt.trim()) { setError('Please paste the signed PSBT.'); return; }
    setLoading(true);
    try {
      const result = await api.submitGift(
        {
          psbtBase64: signedPsbt.trim(),
          senderAddress: senderAddress ?? address!,
          recipientAddress: form.recipientAddress.trim(),
          assetName: form.assetName.trim(),
          assetAmount: Number(form.assetAmount),
        },
        token!
      );
      setTxid(result.txid);
      setStep('done');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to broadcast gift.');
    } finally {
      setLoading(false);
    }
  }

  const steps: Step[] = ['form', 'sign', 'submit', 'done'];
  const stepLabels: Record<Step, React.ReactNode> = {
    form: '1. Details',
    sign: '2. Sign',
    submit: '3. Submit',
    done: <span className="flex items-center gap-1"><Check className="w-3.5 h-3.5" /> Done</span>,
  };

  const ownedBalance = Object.values(addressBalances).reduce((s, v) => s + v, 0);

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Gift className="w-7 h-7 text-avian-400" />
        <h1 className="text-3xl font-bold">Gift an Asset</h1>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2 text-sm">
        {steps.map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            {i > 0 && <span className="text-gray-700">—</span>}
            <span className={`font-medium ${step === s ? 'text-avian-400' : steps.indexOf(s) < steps.indexOf(step) ? 'text-gray-500 line-through' : 'text-gray-600'}`}>
              {stepLabels[s]}
            </span>
          </div>
        ))}
      </div>

      {error && (
        <div className="bg-red-900/30 border border-red-800 text-red-300 rounded-lg px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {/* Step 1: Form */}
      {step === 'form' && (
        <div className="card space-y-5">
          <div>
            <label className="label">Asset Name *</label>
            <input
              className="input"
              placeholder="e.g. AVIANWALLPAPER"
              value={form.assetName}
              onChange={(e) => setForm((f) => ({ ...f, assetName: e.target.value }))}
              onBlur={() => { if (form.assetName.trim()) fetchBalance(form.assetName.trim()); }}
            />
            {ownedBalance > 0 && (
              <p className="text-xs text-green-400 mt-1">
                You own {ownedBalance} {form.assetName}
                {Object.keys(addressBalances).length > 1 && (
                  <> across {Object.keys(addressBalances).length} addresses</>
                )}
              </p>
            )}
          </div>

          <div>
            <label className="label">Amount *</label>
            <input
              className="input"
              type="number"
              min="0"
              step="any"
              placeholder="1"
              value={form.assetAmount}
              onChange={(e) => setForm((f) => ({ ...f, assetAmount: e.target.value }))}
            />
          </div>

          {Object.keys(addressBalances).length > 1 && (
            <div>
              <label className="label">Send from address</label>
              <select
                className="input"
                value={senderAddress ?? ''}
                onChange={(e) => setSenderAddress(e.target.value)}
              >
                {Object.entries(addressBalances).map(([addr, bal]) => (
                  <option key={addr} value={addr}>
                    {addr.slice(0, 12)}…{addr.slice(-8)} ({bal} {form.assetName})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="label">Recipient Address *</label>
            <input
              className="input"
              placeholder="R..."
              value={form.recipientAddress}
              onChange={(e) => setForm((f) => ({ ...f, recipientAddress: e.target.value }))}
            />
            <p className="text-xs text-gray-500 mt-1">
              The Avian address to send the asset to
            </p>
          </div>

          <button onClick={handleBuild} disabled={loading} className="btn-primary w-full">
            {loading ? 'Building PSBT…' : 'Build Gift Transaction'}
          </button>
        </div>
      )}

      {/* Step 2: Sign */}
      {step === 'sign' && (
        <div className="card space-y-5">
          <div>
            <h2 className="text-lg font-semibold text-white mb-2">Sign the Gift PSBT</h2>
            <p className="text-sm text-gray-400 mb-4">
              Copy the PSBT below and sign it in your Avian Core wallet using{' '}
              <code className="text-avian-400">walletprocesspsbt</code> with sighash{' '}
              <code className="text-avian-400">ALL|FORKID</code>.
            </p>
          </div>

          <div>
            <label className="label">Unsigned PSBT</label>
            <div className="relative">
              <textarea
                className="input font-mono text-xs h-28 pr-12"
                readOnly
                value={psbtBase64}
              />
              <div className="absolute top-2 right-2">
                <CopyButton text={psbtBase64} />
              </div>
            </div>
          </div>

          <div className="bg-gray-800/50 rounded-lg p-4 text-sm text-gray-300 space-y-2">
            <p className="font-medium text-white">In Avian Core console, run:</p>
            <div className="relative">
              <code className="block bg-gray-900 rounded p-3 text-xs overflow-x-auto break-all">
                walletprocesspsbt &quot;{psbtBase64}&quot; true &quot;ALL|FORKID&quot;
              </code>
              <div className="absolute top-1 right-1">
                <CopyButton text={`walletprocesspsbt "${psbtBase64}" true "ALL|FORKID"`} />
              </div>
            </div>
            <p className="text-gray-500 text-xs">
              Copy the <code className="text-avian-400">psbt</code> value from the result and paste it below.
            </p>
          </div>

          <button
            onClick={() => setStep('submit')}
            className="btn-primary w-full"
          >
            I&apos;ve signed it — Continue →
          </button>

          <button
            onClick={() => { setStep('form'); setError(''); }}
            className="btn-secondary w-full"
          >
            ← Back
          </button>
        </div>
      )}

      {/* Step 3: Submit */}
      {step === 'submit' && (
        <div className="card space-y-5">
          <div>
            <h2 className="text-lg font-semibold text-white mb-2">Submit Signed Gift PSBT</h2>
            <p className="text-sm text-gray-400">
              Paste the signed PSBT from <code className="text-avian-400">walletprocesspsbt</code> below.
            </p>
          </div>

          <div>
            <label className="label">Signed PSBT *</label>
            <textarea
              className="input font-mono text-xs h-28"
              placeholder="Paste signed PSBT here…"
              value={signedPsbt}
              onChange={(e) => setSignedPsbt(e.target.value)}
            />
          </div>

          <button onClick={handleSubmit} disabled={loading} className="btn-primary w-full">
            {loading ? 'Broadcasting…' : 'Send Gift'}
          </button>

          <button
            onClick={() => { setStep('sign'); setError(''); }}
            className="btn-secondary w-full"
          >
            ← Back
          </button>
        </div>
      )}

      {/* Step 4: Done */}
      {step === 'done' && (
        <div className="card text-center py-12 space-y-4">
          <PartyPopper className="w-16 h-16 text-avian-400 mx-auto" />
          <h2 className="text-2xl font-bold text-white">Gift Sent!</h2>
          <p className="text-gray-400">
            <span className="font-semibold text-white">{form.assetAmount} {form.assetName}</span>{' '}
            has been sent to
          </p>
          <p className="font-mono text-sm text-avian-400 break-all px-8">
            {form.recipientAddress}
          </p>
          <div className="pt-4">
            <p className="text-xs text-gray-500 mb-2">Transaction ID</p>
            <div className="flex items-center justify-center gap-2">
              <code className="text-sm text-blue-400 break-all">{txid}</code>
              <CopyButton text={txid} />
            </div>
          </div>
          <div className="flex gap-3 justify-center pt-4">
            <a href="/assets" className="btn-secondary">
              View Assets
            </a>
            <button
              onClick={() => {
                setStep('form');
                setSignedPsbt('');
                setPsbtBase64('');
                setTxid('');
                setForm({ assetName: '', assetAmount: '1', recipientAddress: '' });
              }}
              className="btn-primary"
            >
              Send Another Gift
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
