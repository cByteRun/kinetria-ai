import { demoCategoryIds } from '../../i18n/demo-categories'
import { getTheme } from '../../i18n/theme'
import { Preferences } from '../../components/preferences'
import { getTranslations } from 'next-intl/server'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Route,
  Inbox,
  CircleCheck,
  LockKeyhole,
  Sparkles,
  Check,
} from 'lucide-react'
import accounts from '../../lib/demo-accounts.json'
import { getRole, localPreview } from '../../lib/session'
import { hasSupabase } from '../../lib/supabase/config'
import { roles, type Role } from '../../lib/roles'
import { AuthForm } from '../../components/auth-form'
import '../workspace/prototype.css'
import './login.css'
const errors = ['credentials', 'config', 'profile'] as const
export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const theme = await getTheme()
  const categoryText = await getTranslations('categories')
  const ui = await getTranslations('ui')

  if (await getRole()) redirect('/workspace')
  const { error } = await searchParams
  const t = await getTranslations('login'),
    roleText = await getTranslations('roles')
  const showRoles =
    localPreview || (hasSupabase && Boolean(process.env.KINETRIA_DEMO_PASSWORD))
  return (
    <main className="ir-app ir-login">
      <header className="ir-login-header">
        <Link className="brand-lockup" href="/">
          <span className="brand-mark">
            <Route />
          </span>
          <span>
            Idea<span style={{ fontWeight: 500 }}>Route</span>
          </span>
        </Link>
        <div className="ir-login-header-actions">
          <Link className="ir-home-link" href="/">
            <ArrowLeft size={15} />
            {ui('backToHome')}
          </Link>
          <Preferences theme={theme} compact />
        </div>
      </header>
      <div className="ir-login-grid">
        <section className="ir-login-story">
          <div className="eyebrow">{ui('employeeFeedback')}</div>
          <h1>
            {ui('everyRequest')}
            <br />
            {ui('toAnOutcome')}
          </h1>
          <p className="ir-login-lead">
            {ui('ideasBecomeImprovements')}
            <br />
            {ui('andProblemsFindSolutions')}
          </p>
          <div className="ir-login-route card">
            <div className="card-head">
              <div>
                <h2>{ui('aClearRouteAVisibleResult')}</h2>
                <p>{ui('fromTheFirstMessageToAResponseFor')}</p>
              </div>
              <Route />
            </div>
            <div className="ir-login-stages">
              {[
                [Inbox, '01', ui('request')],
                [Sparkles, '02', ui('review')],
                [CircleCheck, '03', ui('result')],
              ].map(([Icon, n, label]) => {
                const I = Icon as typeof Inbox
                return (
                  <div key={String(n)}>
                    <span className="ir-login-stage-icon">
                      <I />
                    </span>
                    <small>{String(n)}</small>
                    <strong>{String(label)}</strong>
                  </div>
                )
              })}
            </div>
            <div className="route-foot">
              <Check size={15} />
              {ui('everyRequestHasAnOwnerAndANext')}
            </div>
          </div>
          <div className="ir-login-promises">
            <span>
              <LockKeyhole size={15} />
              {ui('accessBasedOnYourRole')}
            </span>
            <span>
              <CircleCheck size={15} />
              {ui('decisionHistory')}
            </span>
          </div>
        </section>
        <section className="ir-login-panel">
          <div className="ir-login-panel-head">
            <span className="workspace-avatar">{ui('mt')}</span>
            <div>
              <strong>{ui('modusTrade')}</strong>
              <small>{ui('workspace')}</small>
            </div>
          </div>
          <h2>{ui('welcome')}</h2>
          <p className="ir-login-description">
            {ui('signInToSuggestAnImprovement')}
            <br />
            {ui('reviewRequestsAndSeeTheOutcome')}
          </p>
          {error && (
            <p className="form-error" role="alert">
              {error === 'connection'
                ? ui('unableToReachTheServerTrySigningIn')
                : t(errors.find((k) => k === error) || 'fallback')}
            </p>
          )}
          {hasSupabase && (
            <AuthForm
              action="/auth/login"
              className="ir-login-form"
              pendingLabel={ui('signingIntoTheWorkspace')}
            >
              <label>
                {ui('workEmail')}
                <input
                  className="form-field"
                  name="email"
                  type="email"
                  placeholder="name@company.kz"
                  autoComplete="username"
                  required
                />
              </label>
              <label>
                {ui('password')}
                <input
                  className="form-field"
                  name="password"
                  type="password"
                  placeholder={ui('enterYourPassword')}
                  autoComplete="current-password"
                  required
                />
              </label>
              <button className="btn primary">
                {ui('signInToWorkspace')}
                <ArrowRight size={16} />
              </button>
            </AuthForm>
          )}
          {showRoles && (
            <details className="ir-demo-login" open>
              <summary>
                <span className="tiny-pill">{ui('demo2')}</span>{' '}
                {ui('tryARole')}
              </summary>
              <p>{ui('testAccountsAndSyntheticRequests')}</p>
              <AuthForm
                action="/auth/login"
                className="ir-demo-accounts"
                pendingLabel={ui('openingTheSelectedWorkspace')}
              >
                {hasSupabase
                  ? accounts
                      .filter((a) => a.role !== 'client')
                      .map((a) => (
                        <button key={a.id} name="account" value={a.id}>
                          <span>
                            <strong>{a.name}</strong>
                            <small>
                              {roleText(a.role as Role)}
                              {a.category
                                ? ' · ' +
                                  (demoCategoryIds[a.category]
                                    ? categoryText(demoCategoryIds[a.category])
                                    : a.category)
                                : ''}
                            </small>
                          </span>
                          <ArrowUpRight size={15} />
                        </button>
                      ))
                  : (Object.keys(roles) as Role[])
                      .filter((r) => r !== 'client')
                      .map((r) => (
                        <button key={r} name="role" value={r}>
                          <strong>{roleText(r)}</strong>
                          <ArrowUpRight size={15} />
                        </button>
                      ))}
              </AuthForm>
            </details>
          )}
          {!hasSupabase && !localPreview && <p>{t('disabled')}</p>}
          <p className="ir-login-security">
            <LockKeyhole size={13} />
            {ui('requestsAreAccessibleWithinYourRole')}
          </p>
        </section>
      </div>
      <footer className="ir-login-footer">
        <span>IdeaRoute / {ui('feedbackOperations')}</span>
        <span>{ui('fromIdeaToOutcome')}</span>
      </footer>
    </main>
  )
}
