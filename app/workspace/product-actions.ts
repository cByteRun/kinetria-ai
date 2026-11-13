'use server'
import { after } from 'next/server'
import { revalidatePath } from 'next/cache'
import { getLocale } from 'next-intl/server'
import { createClient } from '../../lib/supabase/server'
import { getRole } from '../../lib/session'
import { hasSupabase } from '../../lib/supabase/config'
import { uuidPattern } from '../../lib/requests'
import { askQvin } from '../../lib/qvin'
import { enrichRequest } from '../../lib/enrich-request'
import { deliverOutbox } from '../../lib/telegram/delivery'

export async function portalAction(op:string,data:Record<string,unknown>) {
 if(!hasSupabase || !(await getRole()) || !['submit','vote','moderate'].includes(op)) return {error:'unavailable'}
 const db=await createClient()
 const {data:result,error}=await db.rpc('feedback_portal',{p_op:op,p_data:data})
 if(error) return {error:error.code==='PT409'?'conflict':'saveError'}
 if(op==='submit' && result?.request_id) after(async()=>{try{await enrichRequest(result.request_id)}catch{ /* Registration remains usable; explicit retry in staff card. */ } await deliverOutbox()})
 if(op==='moderate') after(async()=>{await deliverOutbox()})
 revalidatePath('/feedback');revalidatePath('/workspace','layout')
 return {ok:true}
}
export async function registryQvin(question:string,ids:string[],history:{question:string;answer:string}[]=[]) {
 const role=await getRole()
 if(!hasSupabase || !['admin','manager'].includes(role||'') || typeof question!=='string' || question.length>2000 || !Array.isArray(ids) || ids.length>200 || !ids.every(id=>typeof id==='string' && uuidPattern.test(id)) || new Set(ids).size!==ids.length || !Array.isArray(history) || history.length>6 || !history.every(h=>typeof h.question==='string' && h.question.length<=2000 && typeof h.answer==='string' && h.answer.length<=20000)) return {error:'unavailable'}
 const db=await createClient()
 if(!ids.length) return {error:'empty'}
 const {data:rows,error}=await db.from('requests').select('id,title,description,status,category_id,created_at,origin').in('id',ids)
 // Client supplies only membership; all context is read again under RLS.
 if(error || !rows || rows.length!==ids.length) return {error:'unavailable'}
 const {data:impacts,error:impactError}=await db.from('request_enrichments').select('request_id,report').in('request_id',ids)
 if(impactError) return {error:'unavailable'}
 try { return {text:await askQvin(question,rows.map(r=>({...r,report:impacts?.find(i=>i.request_id===r.id)?.report})),await getLocale(),false,history)} } catch{return {error:'aiUnavailable'}}
}
export async function retryImpact(id:string) {
 if(!['admin','manager','handler'].includes((await getRole())||'') || !uuidPattern.test(id)) return {error:'unavailable'}
 const db=await createClient()
 const {data,error}=await db.from('requests').select('id').eq('id',id).maybeSingle()
 if(error || !data) return {error:'unavailable'}
 try{await enrichRequest(id,await getLocale()); revalidatePath('/workspace','layout');return {ok:true}}catch{return {error:'aiUnavailable'}}
}
