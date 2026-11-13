import { getColorTheme, getTheme } from '../../i18n/theme'
import { GlobalHeader } from '../../components/global-header'
import { getTranslations } from 'next-intl/server'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowRight, LockKeyhole, Send, Lightbulb, UsersRound, CircleCheck, Wrench, ShieldCheck } from 'lucide-react'
import accounts from '../../lib/demo-accounts.json'
import { getProfile, localPreview } from '../../lib/session'
import { hasSupabase } from '../../lib/supabase/config'
import { AuthForm } from '../../components/auth-form'
import './login.css'

const errors = ['credentials', 'config', 'profile'] as const
const groups = [
  { role: 'employee', icon: Lightbulb },
  { role: 'manager', icon: UsersRound },
  { role: 'handler', icon: Wrench },
  { role: 'admin', icon: ShieldCheck },
  { role: 'client', icon: UsersRound },
] as const

export default async function Login({ searchParams }: {
  searchParams: Promise<{ error?: string }>
}) {
  const showRoles = localPreview || (hasSupabase && Boolean(process.env.KINETRIA_DEMO_PASSWORD))
  const profile = await getProfile()
  if (profile && !showRoles) redirect('/workspace')
  const [theme, ui, t, text, roleText, { error }, colorTheme] = await Promise.all([
    getTheme(), getTranslations('ui'), getTranslations('login'),
    getTranslations('simpleLogin'), getTranslations('roles'), searchParams, getColorTheme(),
  ])
  return (
    <main className="entry-page">
      <GlobalHeader theme={theme} colorTheme={colorTheme} />
      <div className="login-split">
        <div className="login-story-column">
          <section className="login-story" aria-labelledby="lifecycle-title">
            <p className="login-eyebrow">{text('eyebrow')}</p>
            <h1 id="lifecycle-title">{ui('fromIdeaToOutcome')}</h1>
            <p className="login-story-lead">{text('lead')}</p>
            <ol className="login-lifecycle">
              {[
                { key: 'idea', icon: Lightbulb },
                { key: 'owner', icon: UsersRound },
                { key: 'decision', icon: CircleCheck },
              ].map(({ key, icon: Icon }, index) => <li key={key}>
                <span className="login-stage-icon"><Icon size={21} /></span>
                <div><span className="login-stage-number">0{index + 1}</span><h2>{text(`${key}.title`)}</h2><p>{text(`${key}.description`)}</p></div>
              </li>)}
            </ol>
            <p className="login-story-note"><CircleCheck size={15} />{text('closedLoop')}</p>
          </section>
          <section className="login-telegram" aria-labelledby="telegram-title">
            <div className="login-telegram-heading"><Send size={19} /><h2 id="telegram-title">{text('telegramTitle')}</h2></div>
            <p>{text('telegramLead')}</p>
            <ol>{['signIn', 'link', 'start'].map((step, index) => <li key={step}><span>{index + 1}</span>{text(`telegramSteps.${step}`)}</li>)}</ol>
            {profile && profile.role !== 'client' && <Link className="login-telegram-link" href={`/workspace/${profile.role}?view=help`}>{text('telegramAction')}<ArrowRight size={14} /></Link>}
            <p className="login-telegram-note">{text('telegramNote')}</p>
          </section>
        </div>
        <section className="login-access" aria-labelledby="login-title">
          {profile && <div className="entry-session"><span>{text('current', { name: profile.displayName || roleText(profile.role) })}</span><Link href="/workspace">{text('continue')}<ArrowRight size={14} /></Link></div>}
          <div className="login-access-head"><h2 id="login-title">{text('title')}</h2><span className="login-demo-badge">{text('demo')}</span></div>
          <p className="login-access-description">{text('description')}</p>
          {error && <p className="entry-error" role="alert">{error === 'connection' ? ui('unableToReachTheServerTrySigningIn') : t(errors.find(k => k === error) || 'fallback')}</p>}
          {showRoles && <AuthForm action="/auth/login" className="login-account-list" pendingLabel={ui('openingTheSelectedWorkspace')}>
            {groups.map(({ role, icon: Icon }) => <section className={`login-account-group login-group-${role}`} key={role} aria-labelledby={`role-${role}`}>
              <h3 id={`role-${role}`}>{roleText(role)}{role === 'client' && <span>{text('future')}</span>}</h3>
              {accounts.filter(a => a.role === role && (hasSupabase || a.id === role)).map(account => <button
                key={account.id} name={hasSupabase ? 'account' : 'role'} value={hasSupabase ? account.id : role}
                className="login-account-row" data-account={account.id}>
                <span className="login-account-icon"><Icon size={18} /></span>
                <span className="login-account-copy"><strong>{account.name}</strong><span>{text(`accounts.${account.id}`)}</span></span>
                <ArrowRight className="login-account-arrow" size={16} />
              </button>)}
            </section>)}
          </AuthForm>}
          {!showRoles && <p className="login-unavailable" role="status">{t('disabled')}</p>}
          <p className="login-synthetic">{text(localPreview ? 'preview' : 'synthetic')}</p>
          <section className="login-email" aria-labelledby="email-title" aria-describedby="email-note">
            <div className="login-email-heading"><LockKeyhole size={14} /><h3 id="email-title">{text('emailTitle')}</h3><span>{text('locked')}</span></div>
            <p id="email-note">{text('emailNote')}</p>
            <fieldset disabled className="login-email-fields">
              <legend className="login-sr-only">{text('emailTitle')}</legend>
              <label>{ui('workEmail')}<input type="email" placeholder="name@company.kz" autoComplete="off" /></label>
              <label>{ui('password')}<input type="password" placeholder="••••••••" autoComplete="off" /></label>
            </fieldset>
          </section>
        </section>
      </div>
      <footer className="entry-footer"><span>IdeaRoute · {ui('modusTrade')}</span><span>{text('footer')}</span></footer>
    </main>
  )
}
