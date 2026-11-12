// Run with node --env-file=.env.local scripts/setup-telegram.mjs https://your-app.example
const origin = process.argv[2] || process.env.APP_URL
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
const webhookUrl = new URL('/api/telegram/webhook', origin).href
if (process.env.APP_URL && new URL(process.env.APP_URL).origin !== new URL(origin).origin) throw new Error('APP_URL and webhook origin must match.')
// Verify the deployed handler, its secret, bot identity and database before switching delivery.
const probe = await fetch(webhookUrl, { headers: { 'x-telegram-bot-api-secret-token': secret }, redirect: 'error', signal: AbortSignal.timeout(20000) }).catch(() => { throw new Error('Webhook endpoint unreachable; verify HTTPS deployment and protection settings.') })
const health = await probe.json().catch(() => null)
if (!probe.ok || !health?.ok || health.database !== 'ready') throw new Error('Webhook health check failed; deploy current code and verify server environment/Supabase.')
const bot = await api('getMe', {})
if (health.username !== bot.username) throw new Error('Webhook is configured for a different bot.')
const chat = await api('getChat', {chat_id: channel})
if (chat.type !== 'channel' || chat.username) throw new Error('Use a private channel without a public username.')
const member = await api('getChatMember', {chat_id: channel, user_id: bot.id})
if (member.status !== 'administrator' || !member.can_post_messages || !member.can_edit_messages) throw new Error('Grant bot channel administrator rights: post and edit messages.')
const commands = [
  {command:'start',description:'О боте и начало работы'},
  {command:'home',description:'Главная · меню текущей роли'},
  {command:'help',description:'Как работает бот · помощь по роли'},
  {command:'login',description:'Выбрать аккаунт закрытого демо'},
  {command:'switch',description:'Сменить аккаунт закрытого демо'},
  {command:'demo',description:'Сменить аккаунт закрытого демо'},
  {command:'new',description:'Новое обращение · сотрудник'},
  {command:'draft',description:'Продолжить черновик · сотрудник'},
  {command:'list',description:'Мои обращения / рабочая очередь'},
  {command:'stats',description:'Сводка доступных обращений'},
  {command:'reserve',description:'Резерв · администратор'},
  {command:'cancel',description:'Отменить текущий шаг'},
  {command:'unlink',description:'Отключить аккаунт'},
]
await api('setMyCommands', {commands})
const registeredCommands = await api('getMyCommands', {})
if (JSON.stringify(registeredCommands) !== JSON.stringify(commands)) throw new Error('Bot command registration readback failed.')
await api('setWebhook', {url: webhookUrl,secret_token:secret,max_connections:1,allowed_updates:['message','callback_query']})
const registered = await api('getWebhookInfo', {})
if (registered.url !== webhookUrl || registered.max_connections !== 1) throw new Error('Webhook registration readback failed.')
console.log(`Configured @${bot.username}; private channel verified; webhook enabled. Set TELEGRAM_BOT_USERNAME=${bot.username} in the app environment.`)
