/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
    serverComponentsExternalPackages: ['cheerio'],
    instrumentationHook: true, // Enable instrumentation for auto-migrations
  },
  images: {
    domains: ['www.sudouest.fr', 'public.blob.vercel-storage.com'],
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Externaliser cheerio complètement côté serveur
      config.externals = [...(config.externals || []), 'cheerio']
    }
    
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      net: false,
      tls: false,
    }
    
    return config
  },
}

module.exports = nextConfig

