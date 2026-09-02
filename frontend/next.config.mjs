/** @type {import('next').NextConfig} */
const nextConfig = {
  // Empty config, rewrites removed to prevent intercepting NextAuth /api/auth paths
  typescript: {
    // !! WARN !!
    // Dangerously allow production builds to successfully complete even if
    // your project has type errors.
    // !! WARN !!
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
