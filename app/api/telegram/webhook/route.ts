import { after } from 'next/server'
import { secretMatches, telegram, telegramDb } from '../../../../lib/telegram/api'
import { parseUpdate, enqueueUpdate, drainInbox } from '../../../../lib/telegram/inbox'
import type { Update } from '../../../../lib/telegram/bot'
import { deliverOutbox } from '../../../../lib/telegram/delivery'
export const runtime = 'nodejs'
export const maxDuration = 60
export async function POST(request: Request) {
  if (!secretMatches(request.headers.get('x-telegram-bot-api-secret-token'), process.env.TELEGRAM_WEBHOOK_SECRET)) return new Response('Unauthorized', { status: 401 })
  if (Number(request.headers.get('content-length')) > 65536) return new Response('Too large', { status: 413 })
  let update: Update
  try {
    const raw = await request.text()
    if (raw.length > 65536) return new Response('Too large', { status: 413 })
    update = parseUpdate(JSON.parse(raw) as unknown)
  } catch { return new Response('Invalid update', { status: 400 }) }
  try {
    const queued = await enqueueUpdate(update)
    if (queued) after(async () => {
      try { await drainInbox() } catch { console.error('Telegram background inbox failed') }
      // Deliver newly created domain events even if another inbox job failed.
      try { await deliverOutbox() } catch { console.error('Telegram background outbox failed') }
    })
    return Response.json({ ok: true })
  } catch (error) {
    const known = ['busy', 'Telegram delivery failed', 'fetch failed', 'conflict', 'unavailable', 'unlinked', 'Telegram database not configured']
    const reason = error instanceof Error && (known.includes(error.message) || /^Telegram delivery failed: HTTP [0-9]+, code [0-9]+$/.test(error.message)) ? error.message : 'processing failed'
    console.error('Telegram webhook:', reason)
    // Do not log request bodies, provider URLs with bot token, or employee data.
    return new Response('Retry later', { status: 503, headers: { 'X-IdeaRoute-Error': reason } })
  }
}

// Authenticated connectivity probe; never returns credentials or employee data.
export async function GET(request: Request) {
  if (!secretMatches(request.headers.get('x-telegram-bot-api-secret-token'), process.env.TELEGRAM_WEBHOOK_SECRET)) return new Response('Unauthorized', { status: 401 })
  try {
    const [bot, database] = await Promise.all([
      telegram<{ username: string }>('getMe', {}),
      telegramDb().from('telegram_sessions').select('telegram_id').limit(0),
    ])
    if (database.error) throw new Error('Database unavailable')
    return Response.json({ ok: true, username: bot.username, database: 'ready' })
  } catch (error) {
    const reason = error instanceof Error && /^Telegram delivery failed: HTTP [0-9]+, code [0-9]+$/.test(error.message) ? error.message : error instanceof Error && ['Provider timeout', 'Provider connection failed', 'Provider response failed', 'Database unavailable', 'Telegram database not configured'].includes(error.message) ? error.message : error instanceof Error ? error.name : 'Error'
    return Response.json({ ok: false, reason }, { status: 502 })
  }
}
