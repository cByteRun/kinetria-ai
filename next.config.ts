import type { NextConfig } from 'next'
import createNextIntlPlugin from 'next-intl/plugin'

const config: NextConfig = {
  devIndicators: false,
  agentRules: false,
}

export default createNextIntlPlugin()(config)
