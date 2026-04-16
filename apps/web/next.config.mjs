/** @type {import('next').NextConfig} */

// Derive the API hostname from the build-time env var so image optimisation
// works regardless of which domain is configured for the API.
const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';
const apiHostname = new URL(apiUrl).hostname;
const apiProtocol = new URL(apiUrl).protocol.replace(':', '');

const nextConfig = {
  output: 'standalone',
  transpilePackages: ['@avian-framework/shared'],
  typedRoutes: true,
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'ipfs.io', pathname: '/ipfs/**' },
      { protocol: 'https', hostname: 'cloudflare-ipfs.com', pathname: '/ipfs/**' },
      { protocol: 'https', hostname: 'dweb.link', pathname: '/ipfs/**' },
      { protocol: 'https', hostname: 'gateway.pinata.cloud', pathname: '/ipfs/**' },
      { protocol: 'https', hostname: 'ipfs.avn.network', pathname: '/ipfs/**' },
      // Uploaded assets — derived from NEXT_PUBLIC_API_URL so any API domain works
      { protocol: apiProtocol, hostname: apiHostname, pathname: '/uploads/**' },
    ],
  },
};

export default nextConfig;
