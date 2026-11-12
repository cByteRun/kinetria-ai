import { telegramDb, say, telegram } from './api'

// No user-written title, description, names of authors, files or decisions in channel.
export function channelText(r: { number: number; category_id: string; category_name?: string; status: string; assignee_id: string | null; due_at: string | null }) {
  const labels: Record<string, string> = { new: 'Новое', review: 'На рассмотрении', clarification: 'Нужно уточнение', in_progress: 'В работе', implemented: 'Реализовано', rejected: 'Отклонено', closed: 'Закрыто' }
  return `📬 IdeaRoute · R-${String(r.number).padStart(3, '0')}\nКатегория: ${r.category_name || r.category_id}\nТема: внутреннее обращение сотрудника\nСтатус: ${labels[r.status] || r.status}\nНазначение: ${r.assignee_id ? 'ответственный назначен' : 'ожидает назначения'}\nСрок: ${r.due_at || 'не указан'}`
}
export async function deliverOutbox() {
  if (!process.env.TELEGRAM_BOT_TOKEN || !process.env.TELEGRAM_CHANNEL_ID) return { sent: 0 }
  const db = telegramDb()
  // Short-lived secrets and private drafts need no indefinite retention.
  await Promise.all([
    db.from('telegram_tokens').delete().lt('expires_at', new Date().toISOString()),
    db.from('telegram_demo_sessions').delete().lt('updated_at', new Date(Date.now() - 86400000).toISOString()),
    db.from('telegram_sessions').delete().lt('updated_at', new Date(Date.now() - 86400000).toISOString()),
    db.from('telegram_updates').delete().eq('done', true).lt('leased_until', new Date(Date.now() - 7 * 86400000).toISOString()),
  ])
  const { data: jobs, error } = await db.from('telegram_outbox').select('*').eq('done', false).lte('next_attempt_at', new Date().toISOString()).or(`leased_until.is.null,leased_until.lt.${new Date().toISOString()}`).order('id').limit(3)
  if (error) throw new Error('Outbox unavailable')
  let sent = 0
  const started = Date.now()
  for (const job of jobs || []) {
    if (Date.now() - started > 25000) break
    const now = new Date().toISOString()
    const { data: lease, error: leaseError } = await db.from('telegram_outbox')
      .update({ leased_until: new Date(Date.now() + 60000).toISOString(), attempts: job.attempts + 1 })
      .eq('id', job.id).eq('done', false).or(`leased_until.is.null,leased_until.lt.${now}`).select('id').maybeSingle()
    if (leaseError) throw new Error('Outbox claim failed')
    if (!lease) continue
    const delivered: Record<string, boolean> = job.delivered || {}
    try {
      const { data: r, error: readError } = await db.from('requests').select('id,number,category_id,status,assignee_id,author_id,due_at').eq('id', job.request_id).single()
      if (readError || !r) throw new Error('Request unavailable')
      const { data: category } = await db.from('request_categories').select('name_ru').eq('id', r.category_id).maybeSingle()
      const safeCard = { ...r, category_name: category?.name_ru }
      const username = process.env.TELEGRAM_BOT_USERNAME?.trim().replace(/^@/, '')
      const buttons = username ? [[{ text: 'Открыть бота', url: `https://t.me/${username}` }]] : []
      const saveProgress = async (key: string) => {
        delivered[key] = true
        const { error } = await db.from('telegram_outbox').update({ delivered }).eq('id', job.id)
        if (error) throw new Error('Delivery receipt failed')
      }
      let failed = false
      if (!delivered.channel) try {
        const channel = process.env.TELEGRAM_CHANNEL_ID!
        const { data: existing, error: existingError } = await db.from('telegram_channel_messages').select('message_id').eq('request_id', r.id).maybeSingle()
        if (existingError) throw new Error('Channel receipt unavailable')
        if (existing) await telegram('editMessageText', { chat_id: channel, message_id: existing.message_id, text: channelText(safeCard), reply_markup: { inline_keyboard: buttons } })
        else {
          const result = await say(channel, channelText(safeCard), buttons)
          const { error } = await db.from('telegram_channel_messages').upsert({ request_id: r.id, message_id: result.message_id })
          if (error) throw new Error('Channel receipt failed')
        }
        // Assignment event supplements the updated original channel card.
        if (job.event === 'assigned') {
          const { data: people } = await db.from('profiles').select('id,display_name,active').in('id', [job.actor_id, job.snapshot.assignee_id].filter(Boolean))
          const name = (id: string) => people?.find(p => p.id === id && p.active)?.display_name || 'участник системы'
          await say(channel, `👔 R-${String(r.number).padStart(3, '0')} · назначение\nИнициатор: ${name(job.actor_id)}\nОтветственный: ${job.snapshot.assignee_id ? name(job.snapshot.assignee_id) : 'не назначен'}\nСрок: ${job.snapshot.due_at || '—'}`, buttons)
        }
        await saveProgress('channel')
      } catch { failed = true }
      // Only author and CURRENT assignee. No broadcast to uninvolved handlers.
      const recipients = [...new Set([r.author_id, r.assignee_id].filter(Boolean))]
      const { data: links, error: linkError } = await db.from('telegram_links').select('telegram_id,user_id').in('user_id', recipients)
      if (linkError) throw new Error('Recipients unavailable')
      const { data: profiles, error: profileError } = await db.from('profiles').select('id').in('id', recipients).eq('active', true)
      if (profileError) throw new Error('Recipients unavailable')
      for (const link of links || []) {
        if (delivered[link.user_id] || !profiles?.some(p => p.id === link.user_id)) continue
        try {
          await say(link.telegram_id, `🔔 R-${String(r.number).padStart(3, '0')} · ${job.event}\nТекущий статус: ${r.status}\n${link.user_id === r.assignee_id ? 'Вы назначены ответственным. ' : ''}Откройте /list, чтобы посмотреть обращение и результат.`, [[{ text: 'Открыть обращение', callback_data: 'open:' + r.id }]])
          await saveProgress(link.user_id)
        } catch { failed = true }
      }
      if (failed) throw new Error('Partial delivery')
      const { error: doneError } = await db.from('telegram_outbox').update({ done: true, leased_until: null }).eq('id', job.id)
      if (doneError) throw new Error('Delivery receipt failed')
      sent++
    } catch {
      await db.from('telegram_outbox').update({ leased_until: null, next_attempt_at: new Date(Date.now() + Math.min(3600, 30 * 2 ** Math.min(job.attempts, 7)) * 1000).toISOString() }).eq('id', job.id)
      // Keep durable job for retry; never roll back a registered request.
      continue
    }
  }
  return { sent }
}
