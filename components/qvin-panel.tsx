'use client'
import { Sparkles } from 'lucide-react'
import { useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { registryQvin } from '../app/workspace/product-actions'
import { AiMarkdown } from './ai-markdown'
export function QvinPanel({ids,open,onToggle}:{ids:string[];open?:boolean;onToggle?:(open:boolean)=>void}){
 const t=useTranslations('productExpansion'),[question,setQuestion]=useState(''),[conversation,setConversation]=useState<{question:string;answer:string}[]>([]),[error,setError]=useState(''),[pending,start]=useTransition()
 return <details id="registry-qvin-panel" className="detail-block qvin-panel" open={open} onToggle={e=>onToggle?.(e.currentTarget.open)}><summary><Sparkles size={18} aria-hidden="true" />{t('askQvin')}</summary><p>{t('qvinScope',{count:ids.length})}</p>{conversation.map((m,i)=><div key={i}><strong>{m.question}</strong><AiMarkdown text={m.answer}/></div>)}{error&&<p role="alert">{error}</p>}<form onSubmit={e=>{e.preventDefault();const q=question;setError('');start(async()=>{try{const r=await registryQvin(q,ids,conversation.slice(-6));if(r.text){setConversation(c=>[...c,{question:q,answer:r.text}]);setQuestion('')}else setError(t(r.error||'aiUnavailable'))}catch{setError(t('aiUnavailable'))}})}}><label>{t('question')}<textarea value={question} maxLength={2000} rows={3} required onChange={e=>setQuestion(e.target.value)}/></label><button className="btn" disabled={pending||!ids.length||ids.length>200}>{pending?t('working'):t('ask')}</button></form><small>{t('qvinHelp')}</small></details>
}
