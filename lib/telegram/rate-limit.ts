import { setTimeout as delay } from 'node:timers/promises'
import { telegramDb } from './api'

export async function apiSlot(chat: string, cooldown = 0): Promise<number> {
  const { data, error } = await telegramDb().rpc('telegram_api_slot', { p_chat: chat, p_cooldown: cooldown })
  if (error || typeof data !== 'number' || !Number.isFinite(data)) throw new Error('Telegram rate limiter unavailable')
  return data
}
export async function waitForApiSlot(chat: string) {
  const deadline = Date.now() + 8000
  for (;;) {
    const wait = await apiSlot(chat)
    if (wait === 0) return
    if (Date.now() + wait > deadline) throw new Error('Telegram rate limit deferred')
    await delay(Math.max(10, wait))
  }
}
