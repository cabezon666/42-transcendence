import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'avatars.githubusercontent.com', pathname: '/u/**' },
      { protocol: 'https', hostname: 'githubusercontent.com', pathname: '/**' },
      { protocol: 'https', hostname: 'cdn.discordapp.com', pathname: '/avatars/**' }
    ],
  },
  reactStrictMode: true,
};

export default nextConfig;
