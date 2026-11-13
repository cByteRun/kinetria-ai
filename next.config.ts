import type { NextConfig } from 'next'
import createNextIntlPlugin from 'next-intl/plugin'

const config: NextConfig = {
  devIndicators: false,
  distDir: process.env.IDEAROUTE_BUILD_DIR || '.next',
  experimental: { serverActions: { bodySizeLimit: '5mb' } },
  agentRules: false,
}

export default createNextIntlPlugin()(config)
