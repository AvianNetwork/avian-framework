'use client';

import { Search, Check, Clock } from 'lucide-react';

interface PsbtInput {
  has_utxo: boolean;
  is_final: boolean;
  non_witness_utxo?: {
    vout: Array<{ value: number; scriptPubKey: { addresses?: string[] } }>;
  };
}

interface PsbtOutput {
  value: number;
  n: number;
  scriptPubKey: {
    type: string;
    addresses?: string[];
    asm: string;
  };
}

interface DecodedPsbt {
  tx: {
    vin: Array<{ txid: string; vout: number }>;
    vout: PsbtOutput[];
  };
  inputs: PsbtInput[];
  fee?: number;
}

interface AnalyzedPsbt {
  complete: boolean;
  next: string;
  fee?: number;
  estimated_vsize?: number;
}

interface PsbtReviewProps {
  decoded: DecodedPsbt;
  analyzed?: AnalyzedPsbt | null;
  onConfirm?: () => void;
  onCancel?: () => void;
  confirmLabel?: string;
  loading?: boolean;
}

export function PsbtReview({
  decoded,
  analyzed,
  onConfirm,
  onCancel,
  confirmLabel = 'Sign & Submit',
  loading = false,
}: PsbtReviewProps) {
  return (
    <div className="space-y-6">
      <div className="card space-y-4">
        <h3 className="font-semibold text-lg flex items-center gap-2">
          <Search className="w-5 h-5" /> Review Transaction
        </h3>
        <p className="text-sm text-gray-400">
          Review the inputs and outputs carefully before signing. Once broadcast,
          transactions cannot be reversed.
        </p>

        {/* Inputs */}
        <div className="space-y-2">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Inputs</p>
          {decoded.tx.vin.map((vin, i) => (
            <div key={i} className="bg-gray-800/50 rounded-lg p-3 space-y-1">
              <p className="text-xs text-gray-500">Input {i}</p>
              <p className="font-mono text-xs text-gray-300 truncate">
                {vin.txid}:{vin.vout}
              </p>
              {decoded.inputs[i]?.non_witness_utxo?.vout[vin.vout] && (
                <p className="text-sm text-gray-400">
                  {decoded.inputs[i]!.non_witness_utxo!.vout[vin.vout]!.value} AVN
                  {decoded.inputs[i]!.non_witness_utxo!.vout[vin.vout]!.scriptPubKey.addresses?.[0] && (
                    <span className="ml-2 font-mono text-xs">
                      from {decoded.inputs[i]!.non_witness_utxo!.vout[vin.vout]!.scriptPubKey.addresses![0]}
                    </span>
                  )}
                </p>
              )}
              <span className={`text-xs flex items-center gap-1 ${decoded.inputs[i]?.is_final ? 'text-green-400' : 'text-yellow-400'}`}>
                {decoded.inputs[i]?.is_final
                  ? <><Check className="w-3 h-3" /> Signed</>
                  : <><Clock className="w-3 h-3" /> Awaiting signature</>}
              </span>
            </div>
          ))}
        </div>

        {/* Outputs */}
        <div className="space-y-2">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Outputs</p>
          {decoded.tx.vout.map((vout) => (
            <div key={vout.n} className="bg-gray-800/50 rounded-lg p-3 space-y-1">
              <p className="text-xs text-gray-500">Output {vout.n}</p>
              {vout.scriptPubKey.type === 'nulldata' ? (
                <p className="text-xs text-gray-400 italic">OP_RETURN data</p>
              ) : (
                <>
                  <p className="text-sm font-semibold text-avian-400">{vout.value} AVN</p>
                  {vout.scriptPubKey.addresses?.[0] && (
                    <p className="font-mono text-xs text-gray-400">
                      → {vout.scriptPubKey.addresses[0]}
                    </p>
                  )}
                </>
              )}
            </div>
          ))}
        </div>

        {/* Fee summary */}
        {(analyzed?.fee !== undefined || decoded.fee !== undefined) && (
          <div className="border-t border-gray-800 pt-3 flex items-center justify-between text-sm">
            <span className="text-gray-500">Network fee</span>
            <span className="text-gray-300">
              {(analyzed?.fee ?? decoded.fee ?? 0).toFixed(8)} AVN
            </span>
          </div>
        )}

        {analyzed && (
          <div className={`rounded-lg px-3 py-2 text-sm flex items-center gap-2 ${
            analyzed.complete
              ? 'bg-green-900/30 text-green-300 border border-green-800'
              : 'bg-yellow-900/30 text-yellow-300 border border-yellow-800'
          }`}>
            {analyzed.complete
              ? <><Check className="w-4 h-4" /> Ready to broadcast</>
              : <><Clock className="w-4 h-4" /> Needs: {analyzed.next}</>}
          </div>
        )}
      </div>

      {(onConfirm || onCancel) && (
        <div className="flex gap-3">
          {onCancel && (
            <button onClick={onCancel} className="btn-secondary flex-1" disabled={loading}>
              Cancel
            </button>
          )}
          {onConfirm && (
            <button
              onClick={onConfirm}
              className="btn-primary flex-1"
              disabled={loading}
            >
              {loading ? 'Submitting…' : confirmLabel}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
