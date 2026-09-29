import type { NextConfig } from 'next';

const config: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  output: 'standalone',
  // Do not let `next dev` write agent instruction files into the repository.
  agentRules: false,
};

export default config;
