import { telegramDb } from './api'
import { handleUpdate, type Update } from './bot'

const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)
const id = (value: unknown): value is number => Number.isSafeInteger(value) && Number(value) > 0

// Validate every field consumed by the bot; ignore unsupported Telegram update kinds.
export function parseUpdate(value: unknown): Update {
  if (!record(value) || !Number.isSafeInteger(value.update_id) || Number(value.update_id) < 0) throw new Error('Invalid update')
  const message = (m: unknown) => {
    if (!record(m) || !record(m.chat) || !id(m.chat.id) || typeof m.chat.type !== 'string') return false
    if (m.message_id !== undefined && !id(m.message_id)) return false
    if (m.from !== undefined && (!record(m.from) || !id(m.from.id))) return false
    if (m.text !== undefined && typeof m.text !== 'string') return false
    const file = (f: unknown) => record(f) && typeof f.file_id === 'string' && (f.file_size === undefined || (typeof f.file_size === 'number' && f.file_size >= 0))
    if (m.voice !== undefined && (!file(m.voice) || !record(m.voice) || typeof m.voice.duration !== 'number' || m.voice.duration < 0)) return false
    if (m.document !== undefined && (!file(m.document) || !record(m.document) || (m.document.file_name !== undefined && typeof m.document.file_name !== 'string'))) return false
    if (m.photo !== undefined && (!Array.isArray(m.photo) || !m.photo.length || !m.photo.every(file))) return false
    return true
  }
  if (value.message !== undefined && !message(value.message)) {
    // Group/channel traffic has negative IDs and is outside this private bot.
    if (record(value.message) && record(value.message.chat) && value.message.chat.type !== 'private') return { update_id: Number(value.update_id) }
    throw new Error('Invalid message')
  }
  if (value.callback_query !== undefined) {
    const c = value.callback_query
    if (!record(c) || typeof c.id !== 'string' || !record(c.from) || !id(c.from.id) || (c.data !== undefined && typeof c.data !== 'string') || (c.message !== undefined && !message(c.message))) throw new Error('Invalid callback')
  }
  return value as Update
}
export function updateUser(update: Update): number | undefined {
  const m = update.message || update.callback_query?.message
  const tg = update.callback_query?.from.id || m?.from?.id
  return m?.chat.type === 'private' && tg === m.chat.id ? tg : undefined
}
export async function enqueueUpdate(update: Update) {
  const tg = updateUser(update)
  if (!tg) return false
  const { error } = await telegramDb().rpc('telegram_enqueue', { p_id: update.update_id, p_tg: tg, p_payload: update })
  if (error) throw new Error('Inbox unavailable')
  return true
}
type Job = { id: number; token: string; payload: unknown }
export async function drainInbox() {
  const db = telegramDb()
  let processed = 0
  const started = Date.now()
  // Follow subsequent messages of a chat after releasing its head. Keep each
  // invocation bounded; unfinished durable jobs are recovered by the scheduler.
  for (let batch = 0; batch < 10 && Date.now() - started < 20000; batch++) {
    const { data, error } = await db.rpc('telegram_inbox_claim', { p_limit: 10 })
    if (error) throw new Error('Inbox claim failed')
    const jobs = data as Job[]
    if (!jobs.length) break
    await Promise.all(jobs.map(async job => {
      let success = false
      try { await handleUpdate(parseUpdate(job.payload)); success = true }
      catch { console.error('Telegram inbox processing failed', { updateId: job.id }) }
      const { error } = await db.rpc('telegram_inbox_finish', { p_id: job.id, p_token: job.token, p_success: success })
      if (error) throw new Error('Inbox receipt failed')
    }))
    processed += jobs.length
  }
  return { processed }
}
