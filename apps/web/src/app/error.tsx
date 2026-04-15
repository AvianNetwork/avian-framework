'use client';
import { AlertTriangle } from 'lucide-react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-6">
      <AlertTriangle className="w-16 h-16 text-yellow-400" />
      <h1 className="text-2xl font-semibold text-white">Something went wrong</h1>
      <p className="text-gray-400 max-w-sm text-sm">
        {error.message ?? 'An unexpected error occurred. Please try again.'}
      </p>
      <div className="flex gap-4">
        <button onClick={reset} className="btn-primary">
          Try again
        </button>
        <a href="/" className="btn-secondary">
          Go home
        </a>
      </div>
    </div>
  );
}
