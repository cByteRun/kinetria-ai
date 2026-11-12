// Local transport uses the same domain handler directly, without Next.js outbound networking.
// No public tunnel or cloud Supabase is needed. Never deletes an existing webhook.
import {loadTelegramRuntime} from './telegram-runtime.mjs'
const {handleUpdate,deliverOutbox}=await loadTelegramRuntime()
const token=process.env.TELEGRAM_BOT_TOKEN
if(!token)throw new Error('Set TELEGRAM_BOT_TOKEN')
async function api(method,body={}) {
 const response=await fetch(`https://api.telegram.org/bot${token}/${method}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(30000)})
 const result=await response.json()
 if(!response.ok||!result.ok)throw new Error('Telegram polling failed: '+response.status)
 return result.result
}
const webhook=await api('getWebhookInfo')
if(webhook.url)throw new Error('Webhook already configured; polling cannot run alongside it. Existing webhook was preserved.')
const bot=await api('getMe')
console.log('Polling @'+bot.username+' -> local IdeaRoute; stop with Ctrl+C. No public webhook required for local demo.')
let offset
let stopped=false
let lastError=''
process.on('SIGINT',()=>{stopped=true;process.exit(0)})
process.on('SIGTERM',()=>{stopped=true;process.exit(0)})
while(!stopped){
 try {
  const updates=await api('getUpdates',{offset,timeout:20,limit:20,allowed_updates:['message','callback_query']})
  for(const update of updates){
   await handleUpdate(update)
   offset=update.update_id+1
   console.log('Handled Telegram update '+update.update_id)
   lastError=''
  }
  await deliverOutbox()
 }catch(error){
  const reason=error instanceof Error?error.message:'Polling failed'
  if(reason!==lastError)console.error(reason)
  lastError=reason
  await new Promise(resolve=>setTimeout(resolve,3000))
 }
}
