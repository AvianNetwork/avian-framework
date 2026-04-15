'use client';

import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { api } from '../lib/api';
import { useWallet } from '../context/WalletContext';
import { CopyButton } from './ui/CopyButton';

type Step = 'address' | 'sign' | 'verify';

interface ConnectWalletModalProps {
  onClose: () => void;
  prefillAddress?: string;
}

export function ConnectWalletModal({ onClose, prefillAddress }: ConnectWalletModalProps) {
  const { connect } = useWallet();
  const [step, setStep] = useState<Step>(prefillAddress ? 'address' : 'address');
  const [address, setAddress] = useState(prefillAddress ?? '');
  const [challenge, setChallenge] = useState('');
  const [signature, setSignature] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  async function handleRequestChallenge() {
    if (!address.trim()) {
      setError('Please enter your wallet address.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const result = await api.challenge(address.trim());
      setChallenge(result.challenge);
      setStep('sign');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to request challenge.');
    } finally {
      setLoading(false);
    }
  }

  async function handleVerify() {
    if (!signature.trim()) {
      setError('Please paste your signature.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await connect(address.trim(), challenge, signature.trim());
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Signature verification failed.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl w-full max-w-md mx-4 p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-white">
            {step === 'address' && 'Connect Wallet'}
            {step === 'sign' && 'Sign Challenge'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step 1: Enter address */}
        {step === 'address' && (
          <div className="space-y-4">
            <p className="text-sm text-gray-400">
              Enter your Avian wallet address to connect. You will sign a challenge
              message to prove ownership.
            </p>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Wallet Address
              </label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleRequestChallenge(); }}
                placeholder="R..."
                className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-avian-500 focus:ring-1 focus:ring-avian-500"
              />
            </div>
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <button
              onClick={handleRequestChallenge}
              disabled={loading}
              className="w-full bg-avian-600 hover:bg-avian-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-2 rounded-lg transition-colors"
            >
              {loading ? 'Requesting…' : 'Continue'}
            </button>
          </div>
        )}

        {/* Step 2: Sign in Avian Core */}
        {step === 'sign' && (
          <div className="space-y-4">
            <p className="text-sm text-gray-400">
              Open your <strong className="text-gray-200">Avian Core wallet</strong> and
              sign this message using the address{' '}
              <code className="text-avian-400 break-all">{address}</code>.
            </p>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Challenge Message
              </label>
              <div className="flex gap-2">
                <code className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs text-gray-300 break-all font-mono">
                  {challenge}
                </code>
                <CopyButton text={challenge} />
              </div>
            </div>

            <div className="bg-gray-800 border border-gray-700 rounded-lg p-3 text-xs text-gray-400 space-y-1">
              <p className="font-medium text-gray-300">In Avian Core:</p>
              <p>1. Go to <strong>File → Sign Message</strong> (or the console)</p>
              <p>2. Enter your address and paste the challenge above</p>
              <p>3. Click <strong>Sign Message</strong> and copy the signature</p>
              <p className="pt-1 text-gray-500">Or via console:</p>
              <div className="flex items-start gap-2">
                <code className="flex-1 block text-avian-400 break-all bg-gray-900/50 rounded px-2 py-1.5">
                  signmessage &quot;{address}&quot; &quot;{challenge}&quot;
                </code>
                <CopyButton text={`signmessage "${address}" "${challenge}"`} className="shrink-0 bg-gray-700 hover:bg-gray-600 text-gray-300 text-xs px-2 py-1.5 rounded-lg transition-colors mt-0.5" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Paste Signature
              </label>
              <textarea
                value={signature}
                onChange={(e) => setSignature(e.target.value)}
                placeholder="Paste your base64 signature here…"
                rows={3}
                className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-avian-500 focus:ring-1 focus:ring-avian-500 resize-none font-mono"
              />
            </div>

            {error && <p className="text-red-400 text-sm">{error}</p>}

            <div className="flex gap-3">
              <button
                onClick={() => { setStep('address'); setError(''); }}
                className="flex-1 bg-gray-700 hover:bg-gray-600 text-gray-300 font-medium py-2 rounded-lg transition-colors"
              >
                Back
              </button>
              <button
                onClick={handleVerify}
                disabled={loading}
                className="flex-1 bg-avian-600 hover:bg-avian-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-2 rounded-lg transition-colors"
              >
                {loading ? 'Verifying…' : 'Connect'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
