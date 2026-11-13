import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import ts from 'typescript'
const url=s=>'data:text/javascript;base64,'+Buffer.from(s).toString('base64')
const messages=[],writes=[]
const job={id:1,request_id:'r1',version:2,event:'status',actor_id:'manager',snapshot:{status:'in_progress'},attempts:0,delivered:{}}
class Query{
 constructor(table){this.table=table;this.op='read';this.filters=[]}
 select(){return this} eq(k,v){this.filters.push([k,v]);return this}lt(){return this}lte(){return this}in(){return this}or(){return this}order(){return this}limit(){return this}delete(){this.op='delete';return this}
 update(value){this.op='update';this.value=value;return this} maybeSingle(){this.single=true;return this}single(){this.single=true;return this}
 then(resolve,reject){try{
  if(this.op==='delete')return resolve({data:[],error:null})
  if(this.op==='update'){writes.push({table:this.table,value:this.value});return resolve({data:this.single?{id:1}:[],error:null})}
  const data={telegram_outbox:[job],requests:{id:'r1',number:12,category_id:'catalog',status:'in_progress',assignee_id:'handler',author_id:'client',due_at:null},request_categories:{name_ru:'Каталог'},feedback:{id:'f1',author_id:'client',status:'in_progress',published:true},feedback_votes:[{user_id:'supporter'}],telegram_links:[{telegram_id:11,user_id:'client'},{telegram_id:12,user_id:'handler'},{telegram_id:13,user_id:'supporter'}],profiles:[{id:'client'},{id:'handler'},{id:'supporter'}]}[this.table]
  assert(data!==undefined,'Unexpected table '+this.table);resolve({data,error:null})
 }catch(e){reject(e)}}
}
globalThis.feedbackDelivery={telegramDb:()=>({from:table=>new Query(table)}),say:async(tg,text,buttons)=>messages.push({tg,text,buttons}),telegram:async()=>{throw new Error('No channel send expected')}}
const source=(await readFile(new URL('../lib/telegram/delivery.ts',import.meta.url),'utf8')).replace("'./api'",`'${url('export const {telegramDb,say,telegram}=globalThis.feedbackDelivery')}'`)
const {deliverOutbox}=await import(url(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText))
process.env.TELEGRAM_BOT_TOKEN='mock';delete process.env.TELEGRAM_CHANNEL_ID
assert.equal((await deliverOutbox()).sent,1)
assert.equal(messages.length,3)
for(const tg of [11,13]){const m=messages.find(x=>x.tg===tg);assert.equal(m.buttons[0][0].callback_data,'fbopen:f1');assert(!m.text.includes('handler'));assert(!m.text.includes('R-'));assert(!m.text.includes('status\n'))}
assert.equal(messages.find(x=>x.tg===12).buttons[0][0].callback_data,'open:r1')
assert(writes.some(w=>w.value.done===true));assert(writes.some(w=>w.value.delivered?.client));assert(writes.some(w=>w.value.delivered?.supporter))
console.log('PASS feedback delivery: durable receipts, author/supporter safe portal callbacks, assignee internal callback, private delivery without a configured channel; Telegram mocked')
