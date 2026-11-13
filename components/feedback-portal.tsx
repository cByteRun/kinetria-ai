'use client'
import Link from 'next/link'
import { MessageSquare, ThumbsUp, Clock3, CheckCircle2, Plus, Search } from 'lucide-react'
import { useMemo, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import type { FeedbackRow } from '../lib/feedback'
import { portalAction } from '../app/workspace/product-actions'

export function FeedbackPortal({rows,categories,canSubmit,workspace,preview=false}:{rows:FeedbackRow[];categories:{id:string;name:string}[];canSubmit:boolean;workspace:string;preview?:boolean}) {
 const t=useTranslations('productExpansion'),router=useRouter()
 const [query,setQuery]=useState(''),[status,setStatus]=useState(''),[mine,setMine]=useState(false),[error,setError]=useState(''),[pending,start]=useTransition()
 const key=useRef<string|null>(null)
 const visible=useMemo(()=>rows.filter(r=>(!mine||r.own)&&(!status||r.status===status)&&[r.title,r.description,r.response].join(' ').toLocaleLowerCase().includes(query.toLocaleLowerCase())),[rows,mine,status,query])
 function run(op:string,data:Record<string,unknown>,done?:()=>void){setError('');start(async()=>{try{const result=await portalAction(op,data);if(result.error)setError(t(result.error));else{done?.();router.refresh()}}catch{setError(t('saveError'))}})}
 return <>
  <header className="card portal-hero"><div><span className="portal-eyebrow">IdeaRoute · Feedback</span><h1>{t('portal')}</h1><p>{t('portalIntro')}</p></div><div className="portal-hero-actions">{canSubmit&&<a className="btn primary" href="#new-feedback"><Plus size={16}/>{t('newFeedback')}</a>}{workspace!=='/workspace/client'&&<Link className="btn" href={workspace}>{t('workspace')}</Link>}</div></header>
  <div className="portal-metrics" aria-label={t('portalSnapshot')}>
   {[{label:t('allFeedback'),value:rows.length,icon:MessageSquare},{label:t('supportCount'),value:rows.reduce((sum,row)=>sum+row.votes,0),icon:ThumbsUp},{label:t('in_progress'),value:rows.filter(row=>row.status==='in_progress').length,icon:Clock3},{label:t('implemented'),value:rows.filter(row=>row.status==='implemented').length,icon:CheckCircle2}].map(metric=><section className="card portal-metric" key={metric.label}><metric.icon size={20}/><span>{metric.label}</span><strong>{metric.value}</strong></section>)}
  </div>
  {preview&&<p role="status">{t('preview')}</p>}
  {error&&<p className="form-error" role="alert">{error}</p>}
  <div className={"portal-dashboard"+(canSubmit?" has-compose":"")} >
  {canSubmit&&<section id="new-feedback" className="card portal-compose"><h2>{t('newFeedback')}</h2><form className="portal-form" onSubmit={e=>{e.preventDefault();const form=e.currentTarget,d=new FormData(form);key.current??=crypto.randomUUID();run('submit',{key:key.current,title:d.get('title'),description:d.get('description'),category:d.get('category'),hint:d.get('hint'),kind:d.get('kind')},()=>{key.current=null;form.reset()})}}>
   <label>{t('title')}<input name="title" maxLength={120} required/></label>
   <label>{t('description')}<textarea name="description" maxLength={4000} required rows={4}/></label>
   <label>{t('kind')}<select name="kind"><option value="problem">{t('problem')}</option><option value="idea">{t('idea')}</option><option value="praise">{t('praise')}</option></select></label>
   <label>{t('category')}<select name="category" required>{categories.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
   <label>{t('hint')}<input name="hint" maxLength={500}/><small>{t('hintHelp')}</small></label>
   <p>{t('privateFirst')}</p><button className="btn primary" disabled={pending||preview||!categories.length}>{pending?t('working'):t('send')}</button>
  </form></section>}
  <section className="card portal-feed"><div className="portal-feed-heading"><h2>{t('allFeedback')}</h2><span className="badge">{visible.length}</span></div><div className="filters"><label className="portal-search"><Search size={16}/><input aria-label={t('search')} placeholder={t('search')} value={query} onChange={e=>setQuery(e.target.value)}/></label><select aria-label={t('status')} value={status} onChange={e=>setStatus(e.target.value)}><option value="">{t('all')}</option>{['review','in_progress','implemented','closed'].map(s=><option key={s} value={s}>{t(s)}</option>)}</select><label><input type="checkbox" checked={mine} onChange={e=>setMine(e.target.checked)}/>{t('mine')}</label></div>
  <p>{t('listLimit')}</p>
  <p aria-live="polite">{t('count',{count:visible.length})}</p>
  {visible.map(r=><article className="detail-block portal-entry" key={r.id}>
   <p><span className={'badge '+r.status}>{t(r.status)}</span> · {r.published?t('published'):t('private')}{r.own?' · '+t('yours'):''}</p><h2>{r.title}</h2><p className="request-text">{r.description}</p>
   {r.response&&<blockquote><strong>{t('response')}</strong><p className="request-text">{r.response}</p></blockquote>}
   <button className="btn sm" disabled={pending||preview||!r.published} aria-pressed={r.supported} onClick={()=>run('vote',{id:r.id,support:!r.supported})}>{r.supported?'✓ ':''}{t('support')} · {r.votes}</button>
   {r.can_manage&&<details><summary>{t('moderate')}</summary><Link href={workspace+'?view=registry&id='+r.request_id}>{t('internalCard')}</Link><form className="portal-form" onSubmit={e=>{e.preventDefault();const d=new FormData(e.currentTarget);run('moderate',{id:r.id,version:r.version,published:d.has('published'),public_title:d.get('public_title'),public_description:d.get('public_description'),response:d.get('response')})}}>
    <p>{t('moderationHelp')}</p><label>{t('publicTitle')}<input name="public_title" defaultValue={r.public_title} maxLength={120}/></label><label>{t('publicDescription')}<textarea name="public_description" defaultValue={r.public_description} maxLength={4000}/></label><label>{t('response')}<textarea name="response" defaultValue={r.response} maxLength={2000}/></label><label><input type="checkbox" name="published" defaultChecked={r.published}/>{t('publish')}</label><button className="btn" disabled={pending}>{t('save')}</button>
   </form></details>}
  </article>)}{!visible.length&&<p>{t('empty')}</p>}
  </section>
  </div>
 </>
}
