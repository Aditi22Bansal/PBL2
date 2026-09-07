/** @type {import('next').NextConfig} */
const nextConfig = {
  // Empty config, rewrites removed to prevent intercepting NextAuth /api/auth paths
  // Next.js 16 auto-generates frontend/AGENTS.md + frontend/CLAUDE.md on every
  // dev/build run by default - this repo already has a real, hand-maintained
  // CLAUDE.md at the repo root, so a second auto-generated one here would just
  // be confusing clutter (an agent could easily read the wrong one). Disabled.
  agentRules: false,
  typescript: {
    // !! WARN !!
    // Dangerously allow production builds to successfully complete even if
    // your project has type errors.
    // !! WARN !!
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
