async function telegram(method, body={}) {
 const response=await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/${method}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(10000)})
 const data=await response.json()
 if(!response.ok||!data.ok)throw new Error(`Telegram ${method}: HTTP ${response.status}; check configuration`)
 return data.result
}
try {
 const bot=await telegram('getMe')
 console.log('Bot: @'+bot.username)
 const webhook=await telegram('getWebhookInfo')
 if (!process.env.APP_URL) throw new Error('Set APP_URL to the public HTTPS website origin.')
 const endpoint=new URL('/api/telegram/webhook',process.env.APP_URL)
 if(endpoint.protocol!=='https:')throw new Error('Webhook requires an HTTPS APP_URL.')
 if(webhook.url!==endpoint.href)throw new Error('Webhook missing or differs from APP_URL; run pnpm telegram:webhook after deployment.')
 console.log('Webhook: configured; pending updates: '+webhook.pending_update_count)
 if(webhook.last_error_date) console.log('Last Telegram delivery error at '+new Date(webhook.last_error_date*1000).toISOString()+'; check deployment logs and pending updates.')
 const probe=await fetch(endpoint,{headers:{'x-telegram-bot-api-secret-token':process.env.TELEGRAM_WEBHOOK_SECRET||''},redirect:'error',signal:AbortSignal.timeout(20000)})
 const health=await probe.json()
 if(!probe.ok||!health.ok||health.database!=='ready'||health.username!==bot.username)throw new Error('Webhook probe failed: verify deployed secret, bot and Supabase.')
 console.log('Webhook probe: bot and Supabase ready')
 const channel=await telegram('getChat',{chat_id:process.env.TELEGRAM_CHANNEL_ID})
 console.log('Channel: '+(channel.type==='channel'&&!channel.username?'private channel verified':'NOT a private channel'))
 const member=await telegram('getChatMember',{chat_id:channel.id,user_id:bot.id})
 console.log('Bot rights: '+(member.status==='administrator'&&member.can_post_messages&&member.can_edit_messages?'post/edit verified':'missing administrator post/edit rights'))
 if(process.env.GROQ_API_KEY){
  const response=await fetch('https://api.groq.com/openai/v1/models',{headers:{Authorization:'Bearer '+process.env.GROQ_API_KEY},signal:AbortSignal.timeout(10000)})
  if(!response.ok)throw new Error('Groq models: HTTP '+response.status)
  const data=await response.json()
  console.log('Groq alternatives: '+(data.data||[]).map(m=>m.id).filter(id=>/qwen|gpt-oss-20b|llama-3.1-8b-instant/.test(id)).join(', '))
  for(const model of [process.env.GROQ_WHISPER_MODEL||'whisper-large-v3-turbo',process.env.GROQ_TEXT_MODEL||'qwen/qwen3.8-27b'])console.log('Groq '+model+': '+(data.data?.some(m=>m.id===model)?'available':'unavailable; select a different model'))
 }
}catch(error){console.error(error instanceof Error?error.message:'Connection failed');process.exitCode=1}
