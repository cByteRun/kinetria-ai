import { getLocale, getTranslations } from 'next-intl/server'
import { requireProfile } from '../../lib/session'
import { hasSupabase } from '../../lib/supabase/config'
import { createClient } from '../../lib/supabase/server'
import type { FeedbackRow } from '../../lib/feedback'
import { FeedbackPortal } from '../../components/feedback-portal'
import Link from 'next/link'
import { LogoMark } from '../../components/logo-mark'
import { Preferences } from '../../components/preferences'
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
 return <div className="feedback-page"><main className="portal-container"><nav className="portal-top"><Link className="portal-brand" href="/"><LogoMark/> IdeaRoute</Link><span>{profile.displayName}</span><form action="/auth/logout" method="post"><button className="btn" type="submit">{t('logout')}</button></form><Preferences theme={theme} colorTheme={colorTheme}/></nav>{failed&&<p role="alert">{t('unavailable')}</p>}<FeedbackPortal rows={rows} categories={categories} canSubmit={['client','employee'].includes(profile.role)} workspace={'/workspace/'+profile.role} preview={!hasSupabase||failed}/>{hasSupabase&&<TelegramLink/>}</main></div>
}
