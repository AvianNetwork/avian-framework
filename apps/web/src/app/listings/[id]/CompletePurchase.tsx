'use client';

import { useState, useEffect } from 'react';
import { PartyPopper, Check, Bird } from 'lucide-react';
import { api } from '../../../lib/api';
import { useWallet } from '../../../context/WalletContext';

type Step = 'fund' | 'sign' | 'done';

interface CompletePurchaseProps {
  offerId: string;
  token: string;
}

interface FundingInfo {
  sellerInputTxid: string;
  sellerInputVout: number;
  sellerInputSequence: number;
  sellerAddress: string;
  priceAvn: number;
  assetName: string;
  assetAmount: number;
}

export function CompletePurchase({ offerId, token }: CompletePurchaseProps) {
  const { address: buyerAddress } = useWallet();
  const [step, setStep] = useState<Step>('fund');
  const [fundingInfo, setFundingInfo] = useState<FundingInfo | null>(null);
  const [fundingPsbt, setFundingPsbt] = useState('');
  const [combinedPsbt, setCombinedPsbt] = useState('');
  const [signedPsbt, setSignedPsbt] = useState('');
  const [txid, setTxid] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [infoLoading, setInfoLoading] = useState(true);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    api
      .getOfferFundingInfo(offerId, token)
      .then(setFundingInfo)
      .catch((e: Error) => setError(e.message))
      .finally(() => setInfoLoading(false));
  }, [offerId, token]);

  function copy(text: string, key: string) {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  }

  // The seller's input MUST be at index 0 (SIGHASH_SINGLE|FORKID|ANYONECANPAY commits to input[0] ↔ output[0]).
  // Output[0]: seller's AVN payment  ← seller's sig commits to this; must stay at index 0
  // Output[1]: asset transfer to buyer ← without this the asset is burned when the UTXO is spent
  // Output[2]: buyer's AVN change     ← changePosition:2 places it here
  // sequence must match exactly what the seller signed — extracted from the listing PSBT.
  // weight:600 tells the wallet the expected weight (in WU) of the seller's input so it can
  // estimate fees without needing to "solve" that input (which would fail because it's not
  // in the buyer's wallet). 600 = generous P2PKH estimate (148 bytes × 4 + buffer).
  const fundCmd =
    fundingInfo && buyerAddress
      ? `walletcreatefundedpsbt '[{"txid":"${fundingInfo.sellerInputTxid}","vout":${fundingInfo.sellerInputVout},"sequence":${fundingInfo.sellerInputSequence},"weight":600}]' '[{"${fundingInfo.sellerAddress}":${fundingInfo.priceAvn}},{"${buyerAddress}":{"transfer":{"${fundingInfo.assetName}":${fundingInfo.assetAmount}}}}]' 0 '{"add_inputs":true,"fee_rate":2,"changePosition":2}'`
      : '';

  async function handleCombine() {
    if (!fundingPsbt.trim()) { setError('Paste the psbt value from walletcreatefundedpsbt.'); return; }
    setError('');
    setLoading(true);
    try {
      const result = await api.combineOfferPsbt(offerId, fundingPsbt.trim(), token);
      setCombinedPsbt(result.combinedPsbt);
      setStep('sign');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to combine PSBTs.');
    } finally {
      setLoading(false);
    }
  }

  async function handleComplete() {
    if (!signedPsbt.trim()) { setError('Paste the psbt value from walletprocesspsbt.'); return; }
    setError('');
    setLoading(true);
    try {
      const result = await api.completeOffer(offerId, signedPsbt.trim(), token);
      setTxid(result.txid);
      setStep('done');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to broadcast transaction.');
    } finally {
      setLoading(false);
    }
  }

  const signCmd = `walletprocesspsbt "${combinedPsbt}" true "ALL|FORKID"`;

  if (infoLoading) {
    return (
      <div className="card border-avian-600/40 text-center py-8 text-gray-400">
        Loading purchase details...
      </div>
    );
  }

  return (
    <div className="card space-y-5 border-avian-600/40">
      <div className="flex items-center gap-3">
        <PartyPopper className="w-7 h-7 text-avian-400 shrink-0" />
        <div>
          <h2 className="font-semibold text-lg text-avian-400">Your offer was accepted!</h2>
          <p className="text-sm text-gray-400">Complete the purchase in two steps below.</p>
        </div>
      </div>

      {/* Step indicators */}
      <div className="flex items-center gap-2 text-xs">
        {(['fund', 'sign', 'done'] as Step[]).map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <div className={`w-6 h-6 rounded-full flex items-center justify-center font-bold
              ${step === s ? 'bg-avian-600 text-white' : step === 'done' || (s === 'fund' && step === 'sign') ? 'bg-green-600 text-white' : 'bg-gray-700 text-gray-400'}`}>
              {(step === 'done' || (s === 'fund' && step === 'sign')) && s !== 'done' ? <Check className="w-3.5 h-3.5" /> : i + 1}
            </div>
            <span className={step === s ? 'text-white' : 'text-gray-500'}>
              {s === 'fund' ? 'Fund' : s === 'sign' ? 'Sign' : 'Done'}
            </span>
            {i < 2 && <span className="text-gray-700">›</span>}
          </div>
        ))}
      </div>

      {/* Step 1: Create funding PSBT */}
      {step === 'fund' && (
        <div className="space-y-4">
          <div>
            <p className="text-sm text-gray-300 font-medium mb-1">
              Step 1 — Create a funding PSBT on your Avian Core node
            </p>
            <p className="text-xs text-gray-500 mb-3">
              This builds a PSBT with the seller's asset input at index 0 (required for their
              signature to stay valid) and adds your payment inputs automatically.
              Uses a fixed fee rate of <code className="text-avian-400">2 AVN/vB</code> since
              fee estimation is unavailable on Avian.
              Paste the <code className="text-avian-400">psbt</code> field from the result.
            </p>
            {fundCmd ? (
              <div className="flex gap-2">
                <code className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs text-gray-300 break-all font-mono">
                  {fundCmd}
                </code>
                <button
                  onClick={() => copy(fundCmd, 'fund')}
                  className="shrink-0 bg-avian-600 hover:bg-avian-500 text-white text-xs px-3 py-2 rounded-lg transition-colors"
                >
                  {copied === 'fund' ? <Check className="w-3.5 h-3.5" /> : 'Copy'}
                </button>
              </div>
            ) : (
              <p className="text-red-400 text-xs">{error || 'Could not load seller UTXO details.'}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Paste the <code className="text-avian-400">psbt</code> value
            </label>
            <textarea
              value={fundingPsbt}
              onChange={(e) => setFundingPsbt(e.target.value)}
              placeholder="cHNidP8B..."
              rows={3}
              className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-avian-500 focus:ring-1 focus:ring-avian-500 resize-none font-mono"
            />
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <button
            onClick={handleCombine}
            disabled={loading || !fundingInfo}
            className="w-full bg-avian-600 hover:bg-avian-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-2 rounded-lg transition-colors"
          >
            {loading ? 'Preparing PSBT...' : 'Continue →'}
          </button>
        </div>
      )}

      {/* Step 2: Sign combined PSBT */}
      {step === 'sign' && (
        <div className="space-y-4">
          <div>
            <p className="text-sm text-gray-300 font-medium mb-1">
              Step 2 — Sign the combined PSBT on your Avian Core node
            </p>
            <p className="text-xs text-gray-500 mb-3">
              The seller's signature has been injected into input 0. Your wallet will sign
              your own payment inputs. Paste the <code className="text-avian-400">psbt</code> field from the result.
            </p>
            <div className="flex gap-2">
              <code className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs text-gray-300 break-all font-mono">
                {signCmd}
              </code>
              <button
                onClick={() => copy(signCmd, 'sign')}
                className="shrink-0 bg-avian-600 hover:bg-avian-500 text-white text-xs px-3 py-2 rounded-lg transition-colors"
              >
                {copied === 'sign' ? <Check className="w-3.5 h-3.5" /> : 'Copy'}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Paste the signed <code className="text-avian-400">psbt</code> value
            </label>
            <textarea
              value={signedPsbt}
              onChange={(e) => setSignedPsbt(e.target.value)}
              placeholder="cHNidP8B..."
              rows={3}
              className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-avian-500 focus:ring-1 focus:ring-avian-500 resize-none font-mono"
            />
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <div className="flex gap-3">
            <button
              onClick={() => { setStep('fund'); setError(''); }}
              className="flex-1 bg-gray-700 hover:bg-gray-600 text-gray-300 font-medium py-2 rounded-lg transition-colors"
            >
              Back
            </button>
            <button
              onClick={handleComplete}
              disabled={loading}
              className="flex-1 bg-avian-600 hover:bg-avian-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-2 rounded-lg transition-colors"
            >
              {loading ? 'Broadcasting…' : 'Complete Purchase'}
            </button>
          </div>
        </div>
      )}

      {/* Done */}
      {step === 'done' && (
        <div className="space-y-3">
          <div className="bg-green-900/20 border border-green-700/40 rounded-lg px-4 py-4 text-center">
            <p className="text-green-400 font-semibold text-lg mb-1 flex items-center justify-center gap-2">Purchase complete! <Bird className="w-6 h-6" /></p>
            <p className="text-sm text-gray-400">Transaction broadcast to the Avian network.</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">Transaction ID</p>
            <div className="flex gap-2 items-center">
              <code className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs text-avian-400 break-all font-mono">
                {txid}
              </code>
              <button
                onClick={() => copy(txid, 'txid')}
                className="shrink-0 bg-gray-700 hover:bg-gray-600 text-gray-300 text-xs px-3 py-2 rounded-lg transition-colors"
              >
                {copied === 'txid' ? <Check className="w-3.5 h-3.5" /> : 'Copy'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
