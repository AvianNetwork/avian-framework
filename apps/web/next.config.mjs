/** @type {import('next').NextConfig} */
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
      // Locally uploaded assets
      { protocol: 'http', hostname: 'localhost', port: '4000', pathname: '/uploads/**' },
      { protocol: 'https', hostname: 'api.psbt.avn.network', pathname: '/uploads/**' },
    ],
  },
};

export default nextConfig;
