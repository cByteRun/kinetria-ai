import { transcribeAudio, maxVoiceBytes } from '../speech'
import type { BridgeResults, TelegramDetail } from './contracts'
import { apiSlot, waitForApiSlot } from './rate-limit'
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
export function bridge(tg:number,op:'topics',data:{op:'list'}):Promise<import('../topics').SavedTopic[]>
export function bridge(tg:number,op:'topics',data:{op:'rows'}):Promise<import('../topics').TopicRow[]>
export function bridge(tg:number,op:'topics',data:{op:'save';data:import('../topics').TopicDraft}):Promise<string>
export function bridge(tg:number,op:'topics',data:{op:'delete';data:{id:string}}):Promise<boolean>
export function bridge(tg:number,op:'portal',data:{op:'list'}):Promise<import('../feedback').FeedbackRow[]>
export function bridge(tg:number,op:'portal',data:{op:'submit';data:object}):Promise<{id:string;request_id:string}>
export function bridge(tg:number,op:'portal',data:{op:'vote';data:object}):Promise<boolean>
export function bridge<K extends keyof BridgeResults>(tg: number, op: K, data?: object): Promise<BridgeResults[K]>
export async function bridge(tg: number, op: keyof BridgeResults, data: object = {}): Promise<unknown> {
  // History pages reuse the existing detail authorization before the service
  // client reads events. No new privileged SQL endpoint is needed.
  const { data: rawResult, error } = await telegramDb().rpc('telegram_bridge', { p_tg: tg, p_op: op === 'history' ? 'detail' : op, p_data: data })
  if (error) {
    // Older hosted bridges treat the new qvin operation as a request lookup and
    // return PT404. Reuse the authorized topic reader instead of widening scope
    // with a service-role table query. Keep genuine provider failures retryable.
    if (op === 'qvin' && error.code === 'PT404') {
      const context = await bridge(tg, 'context')
      if (!['admin', 'manager'].includes(context.role)) throw new Error('unavailable')
      const rows = await bridge(tg, 'topics', { op: 'rows' })
      return rows.slice(0, 100).map(({ id, title, description, status, created_at, category_id }) => ({ id, title, description, status, created_at, category_id }))
    }
    if (error.code === 'PT409') throw new Error('conflict')
    if (error.code === '42501') throw new Error('unlinked')
    // Only deterministic domain rejections may acknowledge the update. Network,
    // gateway, schema and database failures must remain retryable in the inbox.
    if (['PT404', '22023', '22P02', '22007', '22008', '23514', 'P0001'].includes(error.code)) throw new Error('unavailable')
    throw new Error('Telegram database temporarily unavailable')
  }
  // Privileged SQL is the trusted producer of these operation contracts.
  const result = rawResult as TelegramDetail | null
  if (op === 'history' && result) {
    const offset = Number((data as { offset?: number }).offset || 0)
    if (!Number.isSafeInteger(offset) || offset < 0 || offset > 100000) throw new Error('unavailable')
    const { data: events, error: readError } = await telegramDb().from('request_events')
      .select('event_type,actor_role,created_at,status,message,next_step').eq('request_id', result.id)
      .order('id', { ascending: false }).range(offset, offset + 8)
    if (readError) throw new Error('Telegram database temporarily unavailable')
    return { id: result.id, number: result.number, events: events?.slice(0, 8) || [], more: (events?.length || 0) > 8 }
  }
  if (op === 'detail' && result) {
    // Resolve only participants of the request AFTER the bridge scope check.
    // The question must survive more than eight subsequent comments.
    const db = telegramDb()
    const [owner, question] = await Promise.all([
      result.assignee_id ? db.from('profiles').select('display_name').eq('id', result.assignee_id).maybeSingle() : null,
      result.status === 'clarification' ? db.from('request_events').select('message').eq('request_id', result.id).eq('event_type', 'reviewed').eq('status', 'clarification').order('id', { ascending: false }).limit(1).maybeSingle() : null,
    ])
    if (owner?.error || question?.error) throw new Error('Telegram database temporarily unavailable')
    return { ...result, assignee_name: owner?.data?.display_name, clarification_question: question?.data?.message }
  }
  return rawResult as unknown
}
export type Button = { text: string; callback_data?: string; url?: string }
export async function telegram<T = unknown>(method: string, body: object | FormData): Promise<T> {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) throw new Error('Telegram not configured')
  const chat = body instanceof FormData ? String(body.get('chat_id') || '') : 'chat_id' in body ? String(body.chat_id) : undefined
  if (chat) await waitForApiSlot(chat)
  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST', headers: body instanceof FormData ? undefined : { 'Content-Type': 'application/json' }, body: body instanceof FormData ? body : JSON.stringify(body), signal: AbortSignal.timeout(8000),
  })
  const result: { ok?: boolean; result: T; description?: string; error_code?: number; parameters?: { retry_after?: number } } = await response.json()
  if (result.error_code === 429 && chat) {
    await apiSlot(chat, Math.max(1, Math.ceil(result.parameters?.retry_after || 1)))
  }
  if (!response.ok || !result.ok) {
    // Idempotent edits are successful even when Telegram reports unchanged content.
    if (method === 'editMessageText' && result.description?.includes('message is not modified')) return result.result
    const error = new Error('Telegram delivery failed: HTTP ' + response.status + ', code ' + (result.error_code || 'unknown'))
    Object.assign(error, { editUnavailable: method === 'editMessageText' && result.error_code === 400 && /message to edit not found|message can't be edited/i.test(result.description || '') })
    throw error
  }
  return result.result
}
export async function say(chat: number | string, text: string, buttons: Button[][] = [], messageId?: number) {
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
  if (messageId && chunks.length === 1) {
    try {
      return await telegram<{ message_id: number }>('editMessageText', { chat_id: chat, message_id: messageId, text: chunks[0], reply_markup: { inline_keyboard: buttons } })
    } catch (error) {
      // An expired/deleted message can no longer be edited. Network and server
      // failures must reach the webhook retry rather than duplicate messages.
      if (!(error instanceof Error) || !('editUnavailable' in error) || !error.editUnavailable) throw error
    }
  }
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
  const audio = await downloadTelegramFile(fileId, maxVoiceBytes)
  return transcribeAudio(new Blob([new Uint8Array(audio)], { type: 'audio/ogg' }), 'voice.ogg')
}
