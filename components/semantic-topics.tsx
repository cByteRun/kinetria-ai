'use client'
import { useCallback, useEffect, useMemo, useRef, useState, useTransition, type ReactNode } from 'react'
import { useTranslations } from 'next-intl'
import { Trash2 } from 'lucide-react'
import { recurringProblems } from '../lib/insights'
import type { RegistryRow } from './request-registry'
import type { SavedTopic, TopicDraft } from '../lib/topics'
import { createClient } from '../lib/supabase/client'
import type { SemanticTopic } from '../lib/semantic-topics'

export function SemanticTopics({ rows, onSelect, children, enabled=true, onTopicsChange }: {
 rows:RegistryRow[]; onSelect:(ids:string[]|null)=>void; children:ReactNode; enabled?:boolean; onTopicsChange?:(topics:SavedTopic[])=>void
}) {
 const t=useTranslations('topicWorkbench')
 const [prompt,setPrompt]=useState('')
 const [limit,setLimit]=useState(100)
 const [saved,setSaved]=useState<SavedTopic[]>([]),[drafts,setDrafts]=useState<TopicDraft[]>([])
 const [active,setActive]=useState<string|null>(null),[selection,setSelection]=useState<string[]|null>(null)
 const [canDelete,setCanDelete]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('')
 const [pending,start]=useTransition(),busy=useRef(false)
 const similarGroups=useMemo(()=>recurringProblems(rows),[rows])
 const selected=(selection ? rows.filter(row=>selection.includes(row.id)) : [...rows].sort((a,b)=>Date.parse(b.created_at||'')-Date.parse(a.created_at||''))).slice(0,limit)
 const refresh=useCallback(async(signal?:AbortSignal)=>{
  const response=await fetch('/api/topics',{cache:'no-store',signal})
  if(!response.ok){if(response.status===403){setSaved([]);setCanDelete(false)}throw new Error('storage')}
  const data:{topics:SavedTopic[];canDelete:boolean}=await response.json()
  setSaved(data.topics);setCanDelete(data.canDelete)
 },[])
 useEffect(()=>{
  if(!enabled) return
  const controller=new AbortController()
  const load=()=>{if(!busy.current && document.visibilityState==='visible')void refresh(controller.signal).then(()=>{if(!controller.signal.aborted)setError(current=>current===t('storageError')?'':current)}).catch(()=>{if(!controller.signal.aborted)setError(t('storageError'))})}
  load()
  const db=process.env.NEXT_PUBLIC_SUPABASE_URL?createClient():null
  const channel=db?.channel('registry-topics').on('postgres_changes',{event:'*',schema:'public',table:'topics'},load).on('postgres_changes',{event:'*',schema:'public',table:'topic_requests'},load).subscribe()
  const timer=setInterval(load,3000)
  window.addEventListener('focus',load)
  return ()=>{controller.abort();clearInterval(timer);window.removeEventListener('focus',load);if(db&&channel)void db.removeChannel(channel)}
 },[refresh,t,enabled])
 useEffect(()=>{onTopicsChange?.(saved)},[saved,onTopicsChange])
 // Re-evaluate membership on refresh: a deleted topic must not leave a stale filter.
 useEffect(()=>{
  if(!active) return
  const topic=saved.find(item=>item.id===active)||drafts.find(item=>item.id===active)
  if(!topic){setActive(null);onSelect(null)}
  else onSelect(topic.ticketIds)
 },[saved,drafts,active,onSelect])
 function run(action:()=>Promise<void>){setError('');setNotice('');busy.current=true;start(async()=>{try{await action()}catch{setError(t('actionError'))}finally{busy.current=false}})}
 function choose(id:string,ids:string[]){setActive(id);setSelection(ids);onSelect(ids)}
 const activeDraft=drafts.find(topic=>topic.id===active)
 return <div className="topic-layout">
  {enabled&&<section className="topic-workbench" aria-label={t('heading')} aria-busy={pending} data-workspace-busy={pending}>
   <div className="topic-heading"><strong>{t('heading')}</strong><small>{t('hint')}</small></div>
   <div className="topic-chips">
    <button className="btn sm" aria-pressed={active===null} onClick={()=>{setActive(null);setSelection(null);onSelect(null)}}>{t('all')}</button>
    {saved.filter(topic=>topic.ticketIds.some(id=>rows.some(row=>row.id===id))).map(topic=><span className="topic-chip" key={topic.id}>
     <button className="btn sm" aria-pressed={active===topic.id} onClick={()=>choose(topic.id,topic.ticketIds)}>{topic.isAiGenerated&&<span className="topic-ai">✨ AI</span>}{topic.title} ({topic.ticketIds.length})</button>
     {canDelete&&<button className="topic-delete" disabled={pending} aria-label={t('delete',{title:topic.title})} onClick={()=>{if(window.confirm(t('confirmDelete',{title:topic.title})))run(async()=>{const result=await fetch('/api/topics/'+topic.id,{method:'DELETE'});if(!result.ok)throw new Error();await refresh()})}}><Trash2 size={14}/></button>}
    </span>)}
    {drafts.map(topic=><button className="btn sm topic-draft" key={topic.id} aria-pressed={active===topic.id} onClick={()=>choose(topic.id,topic.ticketIds)}><span className="topic-ai">✨ AI</span>{topic.title} ({topic.ticketIds.length}) · {t('draft')}</button>)}
   </div>
   {error&&<p role="alert" className="form-error">{error}</p>}
   {notice&&<p role="status">{notice}</p>}
  </section>}
  {enabled&&<header className="topic-action-bar" aria-label={t('actions')} data-workspace-busy={pending}>
   <div className="topic-actions"><select className="filter-select" aria-label={t('sampleSize')} value={limit} onChange={e=>setLimit(Number(e.target.value))}><option value={100}>{t('latest',{count:100})}</option><option value={200}>{t('latest',{count:200})}</option></select><input className="filter-select topic-prompt" aria-label={t('prompt')} placeholder={t('prompt')} value={prompt} disabled={pending} maxLength={2000} onChange={e=>setPrompt(e.target.value)}/>
    <button className="btn sm" disabled={pending||rows.length<2} onClick={()=>{
     const groups=similarGroups
     const group=groups[0]
     if(!group){setNotice(t('noSimilar'));return}
     const ids=group.rows.map(row=>row.id);setSelection(ids);setActive(null);setDrafts([]);onSelect(ids);setNotice(t('selected',{count:ids.length}))
    }}>{t('similar')}</button>
    <button className="btn sm primary" disabled={pending||selected.length<2||selected.length>200} onClick={()=>run(async()=>{
     const response=await fetch('/api/topics/generate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ids:selected.map(row=>row.id),prompt})})
     const data:{topics?:SemanticTopic[];error?:string}=await response.json()
     if(!response.ok){setError(data.error||t('actionError'));return}
     const next=(data.topics||[]).filter(topic=>topic.ids.length>=2).map(topic=>({id:crypto.randomUUID(),title:topic.title,ticketIds:topic.ids,isAiGenerated:true}))
     setDrafts(next)
     if(next[0])choose(next[0].id,next[0].ticketIds)
     else setNotice(t('empty'))
    })}>{!pending&&<span aria-hidden="true">✨ </span>}{pending?t('working'):t('generate')}</button>
    {activeDraft&&<button className="btn sm primary" disabled={pending} onClick={()=>run(async()=>{
     const response=await fetch('/api/topics',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(activeDraft)})
     if(!response.ok)throw new Error()
     await refresh();setDrafts(items=>items.filter(item=>item.id!==activeDraft.id));setNotice(t('saved'))
    })}>{t('save')}</button>}
    {(selection||drafts.length>0)&&<button className="btn sm" disabled={pending} onClick={()=>{setSelection(null);setDrafts([]);setActive(null);onSelect(null);setNotice('')}}>{t('cancel')}</button>}
   </div>
   {selection&&similarGroups.length>1&&<select className="filter-select" aria-label={t('similar')} value={similarGroups.findIndex(group=>group.rows.length===selection.length&&group.rows.every(row=>selection.includes(row.id)))} onChange={event=>{const group=similarGroups[Number(event.target.value)];if(group){const ids=group.rows.map(row=>row.id);setSelection(ids);setActive(null);setDrafts([]);onSelect(ids)}}}><option value={-1} disabled>{t('similar')}</option>{similarGroups.map((group,index)=><option key={group.category+group.tag} value={index}>{group.tag} ({group.rows.length})</option>)}</select>}
   <small>{t('scope',{count:selected.length})}</small>
  </header>}
  {children}
 </div>
}
