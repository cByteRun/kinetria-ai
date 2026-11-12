import { mkdir, writeFile } from 'node:fs/promises'
const token=process.env.TELEGRAM_BOT_TOKEN,chat=process.env.TELEGRAM_CHANNEL_ID
if(!token||!chat)throw new Error('Set bot token and channel ID')
async function api(method,body){
 const response=await fetch(`https://api.telegram.org/bot${token}/${method}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(10000)})
 const data=await response.json()
 if(!response.ok||!data.ok)throw new Error(method+' HTTP '+response.status)
 return data.result
}
const text='🧪 IdeaRoute · Проверка подключения\nПриватный канал подключён. Новые обращения будут приходить с номером, категорией и статусом назначения. Исходные описания и файлы в канал не публикуются.'
const sent=await api('sendMessage',{chat_id:chat,text,protect_content:true})
await api('editMessageText',{chat_id:chat,message_id:sent.message_id,text:text+'\n✅ Публикация и обновление сообщения проверены.'})
await mkdir('docs/evidence/p1',{recursive:true})
await writeFile('docs/evidence/p1/channel-live.json',JSON.stringify({checkedAt:new Date().toISOString(),message_id:sent.message_id,checks:['private channel post','edit channel post'],synthetic:true},null,2))
console.log('PASS live Telegram: synthetic channel message posted and edited; message_id='+sent.message_id)
