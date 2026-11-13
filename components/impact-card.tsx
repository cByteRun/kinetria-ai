'use client'
import { useState,useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import type { ImpactReport } from '../lib/impact-estimator'
import { retryImpact } from '../app/workspace/product-actions'
export function ImpactCard({id,report}:{id:string;report:ImpactReport|null}){
 const t=useTranslations('productExpansion'),router=useRouter(),[pending,start]=useTransition(),[error,setError]=useState('')
 return <section className="detail-block"><h3>{t('impact')}</h3><p>{t('impactCaution')}</p>{report?<><p><strong>As-Is:</strong> {report.asIs}</p><p><strong>To-Be:</strong> {report.toBe}</p><p>{t('hours')}: {report.hoursPerMonth??'—'} · {t(report.source)} · {report.scope}</p><p>{report.qualitativeEffect}</p><p>{report.influence} · {report.effectType} · {t('score')}: {report.priorityScore}/100</p><p>{t('suggestions')}: {report.category} · {report.topic}</p><ul>{report.assumptions.map((a,i)=><li key={i}>{a}</li>)}</ul><p>{t('money')}: {report.monthlyValue===null?t('noRates'):`${report.monthlyValue} ${report.currency}`}. {t('roiYear')}: {report.roiPercent===null?'—':report.roiPercent+'%'}</p></>:<p>{t('noEstimate')}</p>}{error&&<p role="alert">{error}</p>}<button className="btn sm" disabled={pending} onClick={()=>start(async()=>{try{const result=await retryImpact(id);if(result.error)setError(t(result.error));else{setError('');router.refresh()}}catch{setError(t('aiUnavailable'))}})}>{pending?t('working'):t('estimate')}</button></section>
}
