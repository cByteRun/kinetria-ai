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
 console.log('Webhook: '+(webhook.url?'configured ('+new URL(webhook.url).origin+')':'not configured'))
 const channel=await telegram('getChat',{chat_id:process.env.TELEGRAM_CHANNEL_ID})
 console.log('Channel: '+(channel.type==='channel'&&!channel.username?'private channel verified':'NOT a private channel'))
 const member=await telegram('getChatMember',{chat_id:channel.id,user_id:bot.id})
 console.log('Bot rights: '+(member.status==='administrator'&&member.can_post_messages&&member.can_edit_messages?'post/edit verified':'missing administrator post/edit rights'))
 if(process.env.GROQ_API_KEY){
  const response=await fetch('https://api.groq.com/openai/v1/models',{headers:{Authorization:'Bearer '+process.env.GROQ_API_KEY},signal:AbortSignal.timeout(10000)})
  if(!response.ok)throw new Error('Groq models: HTTP '+response.status)
  const data=await response.json()
  console.log('Groq alternatives: '+(data.data||[]).map(m=>m.id).filter(id=>/gpt-oss-20b|llama-3.1-8b-instant/.test(id)).join(', '))
  for(const model of [process.env.GROQ_WHISPER_MODEL||'whisper-large-v3-turbo',process.env.GROQ_TEXT_MODEL||'openai/gpt-oss-20b'])console.log('Groq '+model+': '+(data.data?.some(m=>m.id===model)?'available':'unavailable; select a different model'))
 }
}catch(error){console.error(error instanceof Error?error.message:'Connection failed');process.exitCode=1}
