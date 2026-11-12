// Run with node --env-file=.env.local scripts/setup-telegram.mjs https://your-app.example
const origin = process.argv[2]
const token = process.env.TELEGRAM_BOT_TOKEN
const secret = process.env.TELEGRAM_WEBHOOK_SECRET
const channel = process.env.TELEGRAM_CHANNEL_ID
if (!origin || !origin.startsWith('https://') || new URL(origin).origin !== origin.replace(/\/$/, '') || !token || !channel || !/^[A-Za-z0-9_-]{20,256}$/.test(secret || '')) throw new Error('Set HTTPS origin, TELEGRAM_BOT_TOKEN, TELEGRAM_CHANNEL_ID and a random webhook secret (20–256 characters).')
async function api(method, body) {
  const r = await fetch(`https://api.telegram.org/bot${token}/${method}`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(body), signal: AbortSignal.timeout(10000) })
  const data = await r.json()
  if (!r.ok || !data.ok) throw new Error(`Telegram ${method} failed; verify bot/channel settings`)
  return data.result
}
const bot = await api('getMe', {})
const chat = await api('getChat', {chat_id: channel})
if (chat.type !== 'channel' || chat.username) throw new Error('Use a private channel without a public username.')
const member = await api('getChatMember', {chat_id: channel, user_id: bot.id})
if (member.status !== 'administrator' || !member.can_post_messages || !member.can_edit_messages) throw new Error('Grant bot channel administrator rights: post and edit messages.')
await api('setMyCommands', {commands:[{command:'new',description:'Новое обращение'},{command:'list',description:'Доступные обращения'},{command:'stats',description:'Сводка очереди'},{command:'cancel',description:'Отменить действие'},{command:'unlink',description:'Отключить аккаунт'}]})
await api('setWebhook', {url: new URL('/api/telegram/webhook', origin).href,secret_token:secret,max_connections:1,allowed_updates:['message','callback_query']})
console.log(`Configured @${bot.username}; private channel verified; webhook enabled. Set TELEGRAM_BOT_USERNAME=${bot.username} in the app environment.`)
