/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      // CloudFront media distribution — set hostname once deployed
      { protocol: 'https', hostname: '**.cloudfront.net' },
    ],
  },
};

export default nextConfig;
