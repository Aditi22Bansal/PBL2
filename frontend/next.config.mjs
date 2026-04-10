/** @type {import('next').NextConfig} */
const nextConfig = {
  // Empty config, rewrites removed to prevent intercepting NextAuth /api/auth paths
  eslint: {
    // Warning: This allows production builds to successfully complete even if
    // your project has ESLint errors.
    ignoreDuringBuilds: true,
  },
  typescript: {
    // !! WARN !!
    // Dangerously allow production builds to successfully complete even if
    // your project has type errors.
    // !! WARN !!
    ignoreBuildErrors: true,
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Prevent jspdf and fflate from being bundled during SSR
      config.externals = config.externals || [];
      config.externals.push('jspdf', 'jspdf-autotable');
    }
    return config;
  },
};

export default nextConfig;
