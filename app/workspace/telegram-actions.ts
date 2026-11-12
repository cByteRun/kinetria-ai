'use server'
import { getRole } from '../../lib/session'
import { createClient } from '../../lib/supabase/server'
export async function createTelegramLink(): Promise<{ url?: string; error?: 'session' | 'configuration' | 'database' }> {
  if (!(await getRole())) return { error: 'session' }
  const username = process.env.TELEGRAM_BOT_USERNAME?.trim().replace(/^@/, '') || ''
  if (!/^[A-Za-z0-9_]{5,32}$/.test(username)) return { error: 'configuration' }
  const db = await createClient()
  const { data, error } = await db.rpc('telegram_link_token')
  if (error || typeof data !== 'string') return { error: 'database' }
  return { url: `https://t.me/${username}?start=${data}` }
}
