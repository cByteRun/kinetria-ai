import {loadTelegramRuntime} from './telegram-runtime.mjs'
const {handleUpdate}=await loadTelegramRuntime()
if(process.env.TELEGRAM_DEMO_ENABLED!=='true')throw new Error('Demo is disabled')
const ids=(process.env.TELEGRAM_DEMO_ALLOWED_IDS||'').split(',').map(Number).filter(id=>Number.isSafeInteger(id)&&id>0)
for(const [index,id] of ids.entries())await handleUpdate({update_id:Date.now()+index,message:{chat:{id,type:'private'},from:{id},text:'/demo'}})
console.log('Demo account menu sent to '+ids.length+' allowlisted participant(s).')
