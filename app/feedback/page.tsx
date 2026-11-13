import { getLocale, getTranslations } from 'next-intl/server'
import { requireProfile } from '../../lib/session'
import { hasSupabase } from '../../lib/supabase/config'
import { createClient } from '../../lib/supabase/server'
import type { FeedbackRow } from '../../lib/feedback'
import { FeedbackPortal } from '../../components/feedback-portal'
import Link from 'next/link'
import { GlobalHeader } from '../../components/global-header'
import { MessageSquare, PlusCircle, UserRound } from 'lucide-react'
import { TelegramLink } from '../../components/telegram-link'
import { getTheme,getColorTheme } from '../../i18n/theme'
import '../workspace/dashboard.css'
import '../workspace/workspace-updates.css'
import './portal.css'
export default async function FeedbackPage(){
 const [profile,locale,t,theme,colorTheme]=await Promise.all([requireProfile(),getLocale(),getTranslations('productExpansion'),getTheme(),getColorTheme()])
 let rows:FeedbackRow[]=[],categories:{id:string;name:string}[]=[],failed=false
 if(hasSupabase){const db=await createClient();const [list,catalog]=await Promise.all([db.rpc('feedback_portal',{p_op:'list'}),db.from('request_categories').select('id,name_ru,name_en,name_kk').eq('active',true)])
 failed=Boolean(list.error||catalog.error); rows=list.data||[];categories=(catalog.data||[]).map(c=>({id:c.id,name:locale==='en'?c.name_en:locale==='kk'?c.name_kk:c.name_ru}))}
 return <div className="feedback-page"><GlobalHeader theme={theme} colorTheme={colorTheme}><form action="/auth/logout" method="post"><button className="global-header-cta" type="submit">{t('logout')}</button></form></GlobalHeader><main className="portal-container">{failed&&<p role="alert">{t('unavailable')}</p>}<FeedbackPortal rows={rows} categories={categories} canSubmit={['client','employee'].includes(profile.role)} workspace={'/workspace/'+profile.role} preview={!hasSupabase||failed}/>{hasSupabase&&<TelegramLink/>}</main><nav className="portal-mobile-tabs" aria-label={t('portal')}><a href="#feedback-list"><MessageSquare size={20}/><span>{t('allFeedback')}</span></a>{['client','employee'].includes(profile.role)&&<a href="#new-feedback"><PlusCircle size={20}/><span>{t('newFeedback')}</span></a>}<Link href={'/workspace/'+profile.role}><UserRound size={20}/><span>{t('workspace')}</span></Link></nav></div>
}
