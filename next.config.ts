
import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**', // Allow any hostname
        port: '',
        pathname: '/**', // Allow any path
      },
      {
        protocol: 'http',
        hostname: '**', // Allow any hostname
        port: '',
        pathname: '/**', // Allow any path
      },
    ],
  },
};

export default nextConfig;
