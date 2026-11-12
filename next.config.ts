import type { NextConfig } from 'next'
import createNextIntlPlugin from 'next-intl/plugin'

const config: NextConfig = {
  devIndicators: false,
  experimental: { serverActions: { bodySizeLimit: '5mb' } },
  agentRules: false,
}

export default createNextIntlPlugin()(config)
