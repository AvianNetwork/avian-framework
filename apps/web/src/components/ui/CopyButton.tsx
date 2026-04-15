'use client';

import { useState } from 'react';
import { Check } from 'lucide-react';
import { toast } from '@/lib/toast';

interface CopyButtonProps {
  text: string;
  /** Label shown before copying. Defaults to "Copy" */
  label?: string;
  className?: string;
}

export function CopyButton({ text, label = 'Copy', className }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      toast('Copied!');
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={
        className ??
        'shrink-0 bg-gray-700 hover:bg-gray-600 text-gray-300 text-xs px-3 py-2 rounded-lg transition-colors'
      }
    >
      {copied ? <><Check className="w-3 h-3 inline mr-1" />Copied</> : label}
    </button>
  );
}
