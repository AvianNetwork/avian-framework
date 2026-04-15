import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-6">
      <p className="text-8xl font-bold text-avian-400">404</p>
      <h1 className="text-2xl font-semibold text-white">Page not found</h1>
      <p className="text-gray-400 max-w-sm">
        The page you&apos;re looking for doesn&apos;t exist or may have been moved.
      </p>
      <div className="flex gap-4">
        <Link href="/marketplace" className="btn-primary">
          Browse marketplace
        </Link>
        <Link href="/" className="btn-secondary">
          Go home
        </Link>
      </div>
    </div>
  );
}
