// A private channel post link is enough; no token or API calls are needed.
const link = process.argv[2]
if (link) {
  const parsed = new URL(link)
  const match = parsed.pathname.match(/^\/c\/(\d+)\/\d+/)
  if (parsed.hostname !== 't.me' || !match) throw new Error('Copy a message link from a private channel, for example https://t.me/c/1234567890/1')
  console.log('TELEGRAM_CHANNEL_ID=-100' + match[1])
} else {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) throw new Error('Set TELEGRAM_BOT_TOKEN in .env.local first, or pass a private channel message link as argument.')
  async function api(method, body={}) {
    const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(10000)})
    const result = await response.json()
    if (!response.ok || !result.ok) throw new Error(`Telegram ${method} failed`)
    return result.result
  }
  const info = await api('getWebhookInfo')
  if (info.url) throw new Error('A webhook already exists. To avoid interrupting it, use a private channel message link as argument instead.')
  // No offset: do not acknowledge or discard pending updates.
  const updates = await api('getUpdates', {timeout:0,limit:100})
  const channels = new Map()
  for (const u of updates) {
    const chat=u.channel_post?.chat || u.my_chat_member?.chat
    if (chat?.type==='channel') channels.set(chat.id,chat.title)
  }
  for (const [id,title] of channels) console.log(`${title}: TELEGRAM_CHANNEL_ID=${id}`)
  if (!channels.size) console.log('Add the bot as a private channel admin and publish a test post, then run again. Or pass a channel message link.')
}
