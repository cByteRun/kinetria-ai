import {readFile,writeFile} from 'node:fs/promises'
import {createClient} from '@supabase/supabase-js'
const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SECRET_KEY,{auth:{persistSession:false}})
const {data,error}=await db.from('telegram_links').select('telegram_id').limit(2)
if(error||data?.length!==1)throw new Error('Expected exactly one linked demo participant. Set TELEGRAM_DEMO_ALLOWED_IDS explicitly when there are multiple participants.')
let lines=(await readFile('.env.local','utf8')).split(/\r?\n/)
const allowed=[...new Set([...(process.env.TELEGRAM_DEMO_ALLOWED_IDS||'').split(',').map(s=>s.trim()).filter(Boolean),String(data[0].telegram_id)])].join(',')
for(const [key,value] of Object.entries({TELEGRAM_DEMO_ENABLED:'true',TELEGRAM_DEMO_ALLOWED_IDS:allowed})){
 lines=lines.filter(line=>!line.startsWith(key+'='));lines.push(key+'='+value)
}
await writeFile('.env.local',lines.join('\n').replace(/\n+$/,'')+'\n')
console.log('Local demo enabled for the existing linked participant; Telegram ID was not printed.')
