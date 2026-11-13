// Local browser transport for the REAL bot/webhook/SQL integration harness.
// Transaction is rolled back when this process terminates. Never sends Telegram API requests.
import {createServer} from 'node:http'
import {readFile} from 'node:fs/promises'
export async function start(h){
 const {sql,compile,toUrl,source,messages,ids}=h
 const literal=v=>"'"+String(v).replaceAll("'","''")+"'"
 const field=s=>{if(!/^[a-z_]+$/.test(s))throw new Error('Invalid field');return s}
 const tables=new Set(['telegram_tokens','telegram_demo_sessions','telegram_sessions','telegram_updates','telegram_outbox','requests','request_categories','feedback','feedback_votes','telegram_links','profiles','telegram_channel_messages'])
 class Query{
  constructor(t){if(!tables.has(t))throw new Error('Invalid table');this.table=t;this.conditions=[];this.columns='*';this.mode='read'}
  select(s='*'){if(s!=='*'&&!/^[a-z_,]+$/.test(s))throw new Error('Invalid fields');this.columns=s;return this}
  eq(k,v){this.conditions.push(field(k)+'='+literal(v));return this}
  lt(k,v){this.conditions.push(field(k)+'<'+literal(v));return this}
  lte(k,v){this.conditions.push(field(k)+'<='+literal(v));return this}
  in(k,vs){this.conditions.push(vs.length?field(k)+' in('+vs.map(literal).join(',')+')':'false');return this}
  or(s){const time=s.split('.lt.')[1];if(!time)throw new Error('Invalid lease');this.conditions.push('(leased_until is null or leased_until<'+literal(time)+')');return this}
  order(s){this.sort=field(s);return this}
  limit(n){this.cap=Number(n);return this}
  delete(){this.mode='delete';return this}
  update(v){this.mode='update';this.values=v;return this}
  upsert(v){this.mode='upsert';this.values=v;return this}
  maybeSingle(){this.one=true;return this}
  single(){this.one=true;return this}
  async then(resolve,reject){try{
   const where=this.conditions.length?' where '+this.conditions.join(' and '):''
   const value=v=>v&&typeof v==='object'?literal(JSON.stringify(v))+'::jsonb':v===null?'null':literal(v)
   let statement
   if(this.mode==='read')statement=`select ${this.columns} from public.${this.table}${where}${this.sort?' order by '+this.sort:''}${this.cap?' limit '+this.cap:''}`
   if(this.mode==='delete')statement=`delete from public.${this.table}${where} returning *`
   if(this.mode==='update')statement=`update public.${this.table} set ${Object.entries(this.values).map(([k,v])=>field(k)+'='+value(v)).join(',')}${where} returning *`
   if(this.mode==='upsert'){const cols=Object.keys(this.values).map(field);statement=`insert into public.${this.table}(${cols}) values(${Object.values(this.values).map(value)}) on conflict(request_id) do update set message_id=excluded.message_id returning *`}
   const data=await sql(this.mode==='read'?`select coalesce(jsonb_agg(x),'[]') from(${statement})x`:`with x as(${statement}) select coalesce(jsonb_agg(x),'[]') from x`)
   resolve({data:this.one?data[0]||null:data,error:null})
  }catch(e){reject(e)}}
 }
 // Existing jobs belong to earlier synthetic tests: isolate this transaction's delivery.
 await sql("with cleared as(update public.telegram_outbox set done=true) select '{}'::jsonb")
 globalThis.demoTelegramTransport={telegramDb:()=>({from:t=>new Query(t)}),say:async(tg,text,buttons=[])=>{messages.push({tg:Number(tg),text,buttons});return{message_id:messages.length}},telegram:async(method,body)=>{if(method==='editMessageText'){const m=messages[body.message_id-1];if(m)m.text=body.text}return true}}
 const delivery=await import(compile((await source('lib/telegram/delivery.ts')).replace("'./api'",`'${toUrl('export const {telegramDb,say,telegram}=globalThis.demoTelegramTransport')}'`)))
 process.env.TELEGRAM_BOT_TOKEN='demo-adapter';process.env.TELEGRAM_CHANNEL_ID='-1000000000000'
 globalThis.demoDelivery=async()=>{let count=0;for(let i=0;i<8;i++){const r=await delivery.deliverOutbox();count+=r.sent;if(!r.sent)break}return{sent:count}}
 const sent=[],result=async()=>({messages,users:ids,sent})
 const server=createServer(async(req,res)=>{try{
  if(req.method==='GET'&&req.url==='/'){res.setHeader('content-type','text/html; charset=utf-8');res.end(await readFile(new URL('./demo-telegram.html',import.meta.url)));return}
  if(req.method==='GET'&&req.url==='/state'){res.setHeader('content-type','application/json');res.end(JSON.stringify(await result()));return}
  if(req.method!=='POST'||req.url!=='/action'){res.writeHead(404);res.end();return}
  if(req.headers.origin!=='http://127.0.0.1:3018')throw new Error('Local browser origin required')
  let body='';for await(const part of req){body+=part;if(body.length>10000)throw new Error('Too large')}
  const a=JSON.parse(body);if(!Object.hasOwn(ids,a.role))throw new Error('Unknown role')
  sent.push({role:a.role,text:a.voice?'🎙 Голосовое сообщение · 15 с':a.text,callback:a.callback})
  if(a.callback)await h.click(a.role,a.callback)
  else if(a.voice)await h.send(a.role,'',{voice:{file_id:'synthetic-voice',duration:15}})
  else await h.send(a.role,a.text)
  res.setHeader('content-type','application/json');res.end(JSON.stringify(await result()))
 }catch(e){res.writeHead(400);res.end(JSON.stringify({error:e.message}))}})
 await new Promise(resolve=>server.listen(3018,'127.0.0.1',resolve));console.log('Telegram demo ready at http://127.0.0.1:3018; real bot + SQL; Telegram/Whisper adapters; ROLLBACK on exit')
 await new Promise(resolve=>{for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>server.close(resolve))})
 delete globalThis.demoDelivery
}
