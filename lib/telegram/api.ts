import { timingSafeEqual } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

export function secretMatches(actual: string | null, expected: string | undefined) {
  if (!actual || !expected) return false
  const a = Buffer.from(actual), b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b)
}
export function telegramDb() {
  const key = process.env.SUPABASE_SECRET_KEY
  if (!key || !process.env.NEXT_PUBLIC_SUPABASE_URL) throw new Error('Telegram database not configured')
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: (url, init) => fetch(url, { ...init, signal: AbortSignal.timeout(8000) }) },
  })
}
export async function bridge(tg: number, op: string, data: object = {}) {
  const { data: result, error } = await telegramDb().rpc('telegram_bridge', { p_tg: tg, p_op: op, p_data: data })
  if (error) throw new Error(error.code === 'PT409' ? 'conflict' : error.code === '42501' ? 'unlinked' : 'unavailable')
  return result
}
export type Button = { text: string; callback_data?: string; url?: string }
export async function telegram<T = unknown>(method: string, body: object): Promise<T> {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) throw new Error('Telegram not configured')
  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(8000),
  })
  const result = await response.json()
  if (!response.ok || !result.ok) {
    // Idempotent edits are successful even when Telegram reports unchanged content.
    if (method === 'editMessageText' && result.description?.includes('message is not modified')) return result.result
    throw new Error('Telegram delivery failed: HTTP ' + response.status + ', code ' + (result.error_code || 'unknown'))
  }
  return result.result
}
export async function say(chat: number | string, text: string, buttons: Button[][] = []) {
  const chunks: string[] = []
  let remaining = text
  while (remaining.length > 3800) {
    const newline = remaining.lastIndexOf('\n', 3800)
    let end = newline > 1900 ? newline : 3800
    const last = remaining.charCodeAt(end - 1)
    if (last >= 0xd800 && last <= 0xdbff) end--
    chunks.push(remaining.slice(0, end))
    remaining = remaining.slice(end).replace(/^\n/, '')
  }
  chunks.push(remaining || ' ')
  let result!: { message_id: number }
  for (const [index, chunk] of chunks.entries()) {
    result = await telegram<{ message_id: number }>('sendMessage', { chat_id: chat, text: chunk, protect_content: true, reply_markup: { inline_keyboard: index === chunks.length - 1 ? buttons : [] } })
  }
  return result
}
export async function downloadTelegramFile(fileId: string, limit: number) {
  const file = await telegram<{ file_path: string; file_size?: number }>('getFile', { file_id: fileId })
  if (!file.file_path || (file.file_size ?? 0) > limit) throw new Error('File too large')
  const response = await fetch(`https://api.telegram.org/file/bot${process.env.TELEGRAM_BOT_TOKEN}/${file.file_path}`, { signal: AbortSignal.timeout(8000) })
  if (!response.ok || Number(response.headers.get('content-length')) > limit) throw new Error('File unavailable')
  const reader = response.body?.getReader()
  if (!reader) throw new Error('File unavailable')
  const chunks: Uint8Array[] = []; let size = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    size += value.length
    if (size > limit) { await reader.cancel(); throw new Error('File too large') }
    chunks.push(value)
  }
  return Buffer.concat(chunks)
}
export async function transcribe(fileId: string) {
  if (!process.env.GROQ_API_KEY) throw new Error('Speech unavailable')
  const audio = await downloadTelegramFile(fileId, 3 * 1024 * 1024)
  const form = new FormData()
  form.set('file', new Blob([new Uint8Array(audio)], { type: 'audio/ogg' }), 'voice.ogg')
  form.set('model', process.env.GROQ_WHISPER_MODEL || 'whisper-large-v3-turbo')
  form.set('response_format', 'json')
  const response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
    method: 'POST', headers: { Authorization: 'Bearer ' + process.env.GROQ_API_KEY }, body: form, signal: AbortSignal.timeout(15000),
  })
  if (!response.ok) throw new Error('Speech unavailable')
  const { text } = await response.json()
  if (typeof text !== 'string' || !text.trim() || text.length > 4000) throw new Error('Invalid transcript')
  return text.trim() as string
}
