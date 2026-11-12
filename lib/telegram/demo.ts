import { createClient } from '@supabase/supabase-js'
import accounts from '../demo-accounts.json' with { type: 'json' }
import { telegramDb } from './api'

export const demoChoices = accounts.filter(account => account.role !== 'client')
export function demoAllowed(telegramId: number) {
  return process.env.TELEGRAM_DEMO_ENABLED === 'true' &&
    (process.env.TELEGRAM_DEMO_ALLOWED_IDS || '').split(',').map(value => value.trim()).includes(String(telegramId))
}
export async function switchDemoAccount(telegramId: number, accountId: string): Promise<{ name: string; role: string }> {
  if (!demoAllowed(telegramId) || !demoChoices.some(account => account.id === accountId) || !process.env.KINETRIA_DEMO_PASSWORD) throw new Error('unavailable')
  const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: (url, init) => fetch(url, { ...init, signal: AbortSignal.timeout(8000) }) },
  })
  // Use the same pre-provisioned accounts and Auth credentials as the web login.
  const { data, error } = await client.auth.signInWithPassword({ email: accountId + '@kinetria.example', password: process.env.KINETRIA_DEMO_PASSWORD })
  if (error) throw new Error(error.status && [400, 401, 403, 422].includes(error.status) ? 'unavailable' : 'Telegram database temporarily unavailable')
  if (!data.user) throw new Error('unavailable')
  try {
    const result = await telegramDb().rpc('telegram_demo_login', { p_tg: telegramId, p_user: data.user.id })
    if (result.error) throw new Error(result.error.code === 'PT409' ? 'demoBusy' : ['42501', '22023'].includes(result.error.code) ? 'unavailable' : 'Telegram database temporarily unavailable')
    if (!result.data) throw new Error('unavailable')
    return result.data
  } finally {
    await client.auth.signOut({ scope: 'local' }).catch(() => undefined)
  }
}
