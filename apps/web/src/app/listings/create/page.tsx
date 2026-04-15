'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Lock, Check, PartyPopper } from 'lucide-react';
import { useWallet } from '../../../context/WalletContext';
import { api } from '../../../lib/api';
import { CopyButton } from '../../../components/ui/CopyButton';

type Step = 'form' | 'sign' | 'submit' | 'done';

interface FormData {
  assetName: string;
  assetAmount: string;
  priceAvn: string;
  expiresInDays: string;
  // Optional manual UTXO override
  manualTxid: string;
  manualVout: string;
}

interface AssetUtxo {
  txid: string;
  vout: number;
  assetAmount: number;
  confirmations: number;
}

export default function CreateListingPage() {
  return (
    <Suspense>
      <CreateListingForm />
    </Suspense>
  );
}

function CreateListingForm() {
  const { address, token, isConnected, knownAddresses } = useWallet();
  const searchParams = useSearchParams();
  const [step, setStep] = useState<Step>('form');
  const [form, setForm] = useState<FormData>(() => ({
    assetName: searchParams.get('asset') ?? '',
    assetAmount: '',
    priceAvn: '',
    expiresInDays: '7',
    manualTxid: '',
    manualVout: '',
  }));
  const [utxos, setUtxos] = useState<AssetUtxo[] | null>(null);
  const [selectedUtxo, setSelectedUtxo] = useState<AssetUtxo | null>(null);
  const [ownedBalance, setOwnedBalance] = useState<number | null>(null);
  // Which address actually holds the asset (may differ from active address)
  const [sellerAddress, setSellerAddress] = useState<string | null>(null);
  // Balances per address for the current asset
  const [addressBalances, setAddressBalances] = useState<Record<string, number>>({});

  // Auto-fetch balance when asset pre-filled from query param
  useEffect(() => {
    const prefilledAsset = searchParams.get('asset');
    if (prefilledAsset) fetchOwnedBalance(prefilledAsset);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address]);
  const [showManual, setShowManual] = useState(false);
  const [psbtBase64, setPsbtBase64] = useState('');
  const [signedPsbt, setSignedPsbt] = useState('');
  const [listingId, setListingId] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copiedCmd, setCopiedCmd] = useState(false);

  function copyPsbt() {
    navigator.clipboard.writeText(psbtBase64);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function copyCommand() {
    navigator.clipboard.writeText(`walletprocesspsbt "${psbtBase64}" true "SINGLE|ANYONECANPAY"`);
    setCopiedCmd(true);
    setTimeout(() => setCopiedCmd(false), 2000);
  }

  if (!isConnected) {
    return (
      <div className="max-w-lg mx-auto text-center py-24 space-y-4">
        <Lock className="w-12 h-12 text-gray-500 mx-auto" />
        <h1 className="text-2xl font-bold">Connect your wallet to continue</h1>
        <p className="text-gray-400">You need to connect your Avian wallet before creating a listing.</p>
        <a href="/marketplace" className="btn-secondary inline-block mt-4">← Back to Marketplace</a>
      </div>
    );
  }

  async function fetchOwnedBalance(assetName: string) {
    if (!address || !assetName.trim()) return;
    const name = assetName.trim();
    // Check all known addresses so linked wallets are included
    const allAddresses = knownAddresses.length > 0 ? knownAddresses : [address];
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
      const total = Object.values(balMap).reduce((s, v) => s + v, 0);
      setOwnedBalance(total);
      // Auto-select the address that holds the asset (prefer active address)
      const owningAddrs = Object.keys(balMap);
      if (owningAddrs.length > 0) {
        setSellerAddress(owningAddrs.includes(address) ? address : owningAddrs[0]!);
      } else {
        setSellerAddress(address);
      }
    } catch {
      // address index may not be enabled — don't block the form
    }
  }

  async function handleLookupUtxos() {
    if (!form.assetName.trim()) return;
    setUtxos(null);
    setSelectedUtxo(null);
    const allAddresses = knownAddresses.length > 0 ? knownAddresses : [address!];
    const apiBase = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';
    try {
      const pages = await Promise.all(
        allAddresses.map((addr) =>
          fetch(`${apiBase}/assets/utxos/${addr}?asset=${encodeURIComponent(form.assetName.trim())}`)
            .then((r) => r.json() as Promise<(AssetUtxo & { address: string })[]>)
            .then((rows) => rows.map((u) => ({ ...u, address: addr })))
            .catch(() => [] as (AssetUtxo & { address: string })[])
        )
      );
      const data = pages.flat();
      setUtxos(data);
      if (data.length === 1) {
        setSelectedUtxo(data[0]!);
        setSellerAddress(data[0]!.address);
        setOwnedBalance(data[0]!.assetAmount);
        setForm((f) => ({ ...f, assetAmount: String(data[0]!.assetAmount) }));
      }
    } catch {
      setUtxos([]);
    }
  }

  async function handleBuildPsbt() {
    setError('');
    if (!form.assetName.trim() || !form.assetAmount || !form.priceAvn) {
      setError('Please fill in all required fields.');
      return;
    }

    // Determine which UTXO to use: manual entry takes priority, then auto-detected picker
    let txid: string | undefined;
    let vout: number | undefined;
    if (form.manualTxid.trim()) {
      txid = form.manualTxid.trim();
      vout = Number(form.manualVout);
    } else if (selectedUtxo) {
      txid = selectedUtxo.txid;
      vout = selectedUtxo.vout;
    } else {
      setError('Please enter the asset UTXO txid and vout, or use Auto-lookup if your address is in the server wallet.');
      return;
    }

    setLoading(true);
    try {
      const result = await api.buildListingPsbt(
        {
          sellerAddress: sellerAddress ?? address!,
          assetName: form.assetName.trim(),
          assetAmount: Number(form.assetAmount),
          priceAvn: Number(form.priceAvn),
          assetUtxoTxid: txid,
          assetUtxoVout: vout,
        },
        token!
      );
      setPsbtBase64(result.psbtBase64);
      setStep('sign');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to build PSBT.');
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit() {
    setError('');
    if (!signedPsbt.trim()) { setError('Please paste the signed PSBT.'); return; }
    setLoading(true);
    try {
      const result = await api.createListing(
        {
          assetName: form.assetName.trim(),
          assetAmount: Number(form.assetAmount),
          priceAvn: Number(form.priceAvn),
          psbtBase64: signedPsbt.trim(),
          ttlSeconds: form.expiresInDays
            ? Number(form.expiresInDays) * 86_400
            : undefined,
        },
        token!
      ) as { id: string };
      setListingId(result.id);
      setStep('done');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create listing.');
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

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <a href="/marketplace" className="hover:text-white transition-colors">Marketplace</a>
        <span>›</span>
        <span className="text-gray-300">Create Listing</span>
      </div>

      <h1 className="text-3xl font-bold">List an Asset</h1>

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

      {/* Step 1: Form */}
      {step === 'form' && (
        <div className="card space-y-5">
          <div>
            <label className="label">Asset Name *</label>
            <input
              className="input"
              placeholder="e.g. MY_TOKEN"
              value={form.assetName}
              onChange={(e) => {
                const name = e.target.value.toUpperCase();
                setForm({ ...form, assetName: name });
                setUtxos(null);
                setSelectedUtxo(null);
                setOwnedBalance(null);
                setAddressBalances({});
                setSellerAddress(address);
              }}
              onBlur={(e) => fetchOwnedBalance(e.target.value)}
            />
          </div>

          {/* UTXO — always show manual entry since the server wallet rarely has the seller's address */}
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-3 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-gray-300">Asset UTXO</p>
              <button
                type="button"
                onClick={handleLookupUtxos}
                disabled={!form.assetName.trim()}
                className="text-xs text-avian-400 hover:underline disabled:opacity-40 disabled:no-underline"
              >
                Auto-lookup (server wallet only)
              </button>
            </div>

            {/* Auto-detected UTXOs */}
            {utxos !== null && utxos.length > 0 && (
              <div className="space-y-1">
                {(utxos as (AssetUtxo & { address?: string })[]).map((u) => (
                  <label key={`${u.txid}:${u.vout}`} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="utxo"
                      checked={selectedUtxo?.txid === u.txid && selectedUtxo?.vout === u.vout}
                      onChange={() => {
                        setSelectedUtxo(u);
                        if (u.address) setSellerAddress(u.address);
                        setShowManual(false);
                        setOwnedBalance(u.assetAmount);
                        setForm((f) => ({ ...f, assetAmount: String(u.assetAmount) }));
                      }}
                      className="accent-avian-500"
                    />
                    <span className="text-xs text-gray-300 font-mono">
                      {u.txid.slice(0, 16)}…:{u.vout}
                      <span className="text-gray-500 ml-2">({u.assetAmount} units, {u.confirmations} confs)</span>
                      {u.address && u.address !== address && (
                        <span className="text-yellow-500 ml-2">{u.address.slice(0, 8)}…</span>
                      )}
                    </span>
                  </label>
                ))}
              </div>
            )}

            {/* Manual entry — always available */}
            <div className="space-y-2">
              <p className="text-xs text-gray-400">
                Enter the txid and vout for your{form.assetName ? ` ${form.assetName}` : ' asset'} UTXO.
                Run this in your Avian Core console to find it:
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 block text-xs text-avian-400 bg-gray-900 rounded px-2 py-1.5 break-all select-all">
                  {`listunspent 1 9999999 '["${sellerAddress ?? address ?? 'YOUR_ADDRESS'}"]'`}
                </code>
                <CopyButton
                  text={`listunspent 1 9999999 '["${sellerAddress ?? address ?? 'YOUR_ADDRESS'}"]'`}
                  className="shrink-0 bg-gray-700 hover:bg-gray-600 text-gray-300 text-xs px-2 py-1.5 rounded-lg transition-colors"
                />
              </div>
              <p className="text-xs text-gray-500">
                Look for the entry where <code className="text-gray-300">&quot;asset&quot;</code> is{' '}
                <code className="text-gray-300">&quot;{form.assetName || 'ASSET_NAME'}&quot;</code>.
                Copy its <code className="text-gray-300">txid</code> and <code className="text-gray-300">vout</code> below.
              </p>
              <div className="flex gap-2">
                <input
                  className="input flex-1 font-mono text-xs"
                  placeholder="txid (64 hex chars)"
                  value={form.manualTxid}
                  onChange={(e) => { setForm({ ...form, manualTxid: e.target.value }); setSelectedUtxo(null); }}
                />
                <input
                  className="input w-20 font-mono text-xs"
                  placeholder="vout"
                  type="number"
                  min="0"
                  value={form.manualVout}
                  onChange={(e) => { setForm({ ...form, manualVout: e.target.value }); setSelectedUtxo(null); }}
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="label mb-0">Amount to Sell *</label>
                {ownedBalance !== null && (
                  <span className="text-xs text-gray-500">
                    You own:{' '}
                    <button
                      type="button"
                      className="text-avian-400 hover:underline font-medium"
                      onClick={() => setForm((f) => ({ ...f, assetAmount: String(ownedBalance) }))}
                    >
                      {ownedBalance.toLocaleString()}
                    </button>
                  </span>
                )}
              </div>
              <input
                className="input"
                type="number"
                min="0"
                max={ownedBalance ?? undefined}
                step="any"
                placeholder={ownedBalance !== null ? String(ownedBalance) : '100'}
                value={form.assetAmount}
                onChange={(e) => {
                  const val = e.target.value;
                  if (ownedBalance !== null && Number(val) > ownedBalance) return;
                  setForm({ ...form, assetAmount: val });
                }}
              />
              {ownedBalance === 0 && (
                <p className="text-red-400 text-xs mt-1">No linked address holds any {form.assetName}.</p>
              )}
            </div>
            <div>
              <label className="label">Price (AVN) *</label>
              <input
                className="input"
                type="number"
                min="0"
                step="any"
                placeholder="50"
                value={form.priceAvn}
                onChange={(e) => setForm({ ...form, priceAvn: e.target.value })}
              />
            </div>
          </div>

          <div>
            <label className="label">Expires In (days)</label>
            <select
              className="input"
              value={form.expiresInDays}
              onChange={(e) => setForm({ ...form, expiresInDays: e.target.value })}
            >
              <option value="">No expiry</option>
              <option value="1">1 day</option>
              <option value="3">3 days</option>
              <option value="7">7 days</option>
              <option value="14">14 days</option>
              <option value="30">30 days</option>
            </select>
          </div>

          <div className="bg-gray-800 rounded-lg p-3 text-xs text-gray-400 space-y-1.5">
            {Object.keys(addressBalances).length > 1 ? (
              <>
                <p className="text-gray-400">Selling from:</p>
                {Object.entries(addressBalances).map(([addr, bal]) => (
                  <label key={addr} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="sellerAddress"
                      checked={sellerAddress === addr}
                      onChange={() => setSellerAddress(addr)}
                      className="accent-avian-500"
                    />
                    <code className="text-avian-400 text-xs">{addr}</code>
                    <span className="text-gray-500">({bal.toLocaleString()} {form.assetName})</span>
                  </label>
                ))}
              </>
            ) : (
              <span>Selling as: <code className="text-avian-400">{sellerAddress ?? address}</code></span>
            )}
          </div>

          {error && (
            <div className="text-red-400 text-sm bg-red-900/20 rounded-lg px-3 py-2">
              <p>{error}</p>
            </div>
          )}

          <button onClick={handleBuildPsbt} disabled={loading} className="btn-primary w-full">
            {loading ? 'Building PSBT…' : 'Build PSBT →'}
          </button>
        </div>
      )}

      {/* Step 2: Sign */}
      {step === 'sign' && (
        <div className="card space-y-5">
          <div>
            <h2 className="font-semibold text-lg mb-1">Sign the PSBT in your wallet</h2>
            <p className="text-sm text-gray-400">
              Run the command below in your Avian Core console, then paste the signed result in the next step.
            </p>
          </div>

          {/* Full command — primary copy target */}
          <div>
            <label className="label">Avian Core Console Command</label>
            <div className="flex gap-2 items-start">
              <code className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs text-avian-400 break-all font-mono block max-h-40 overflow-y-auto">
                walletprocesspsbt &quot;{psbtBase64}&quot; true &quot;SINGLE|ANYONECANPAY&quot;
              </code>
              <button onClick={copyCommand} className="btn-primary shrink-0 self-start">
                {copiedCmd ? <><Check className="w-3.5 h-3.5 inline mr-1" />Copied</> : 'Copy Command'}
              </button>
            </div>
          </div>

          {/* PSBT only — secondary */}
          <details className="text-xs text-gray-500">
            <summary className="cursor-pointer hover:text-gray-300 select-none">Copy PSBT only (Base64)</summary>
            <div className="flex gap-2 items-start mt-2">
              <code className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs text-gray-400 break-all font-mono block max-h-32 overflow-y-auto">
                {psbtBase64}
              </code>
              <button onClick={copyPsbt} className="btn-secondary shrink-0 self-start">
                {copied ? <Check className="w-3.5 h-3.5" /> : 'Copy'}
              </button>
            </div>
          </details>

          <div className="bg-gray-800 border border-gray-700 rounded-lg p-3 text-xs text-gray-500 space-y-1">
            <p>
              <code className="text-gray-300">SINGLE|ANYONECANPAY</code> — commits only to your payment output
              and your asset input. The buyer can attach their payment inputs without invalidating your signature.
              Avian Core applies FORKID automatically.
            </p>
          </div>
          <button onClick={() => setStep('submit')} className="btn-primary w-full">
            I&apos;ve signed it →
          </button>
          <button onClick={() => setStep('form')} className="btn-secondary w-full">← Back</button>
        </div>
      )}

      {/* Step 3: Submit */}
      {step === 'submit' && (
        <div className="card space-y-5">
          <div>
            <h2 className="font-semibold text-lg mb-1">Paste your signed PSBT</h2>
            <p className="text-sm text-gray-400">
              Paste the <code className="text-avian-400">psbt</code> value from the <code className="text-avian-400">walletprocesspsbt</code> result.
            </p>
          </div>
          <div>
            <label className="label">Signed PSBT (Base64)</label>
            <textarea
              className="input resize-none font-mono text-xs"
              rows={5}
              placeholder="Paste signed PSBT here…"
              value={signedPsbt}
              onChange={(e) => setSignedPsbt(e.target.value)}
            />
          </div>
          {error && <p className="text-red-400 text-sm bg-red-900/20 rounded-lg px-3 py-2">{error}</p>}
          <button onClick={handleSubmit} disabled={loading} className="btn-primary w-full">
            {loading ? 'Submitting…' : 'Create Listing'}
          </button>
          <button onClick={() => setStep('sign')} className="btn-secondary w-full">← Back</button>
        </div>
      )}

      {/* Done */}
      {step === 'done' && (
        <div className="card text-center space-y-5 py-12">
          <p className="flex justify-center"><PartyPopper className="w-16 h-16 text-avian-400" /></p>
          <h2 className="text-2xl font-bold">Listing Created!</h2>
          <p className="text-gray-400">Your asset is now listed on the marketplace.</p>
          <div className="flex justify-center gap-3 pt-2">
            <a href={`/listings/${listingId}`} className="btn-primary">View Listing</a>
            <a href="/marketplace" className="btn-secondary">Back to Marketplace</a>
          </div>
        </div>
      )}
    </div>
  );
}
