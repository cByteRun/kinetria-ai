import { getTranslations } from 'next-intl/server'
import { Preferences } from '../../components/preferences'
import { getTheme } from '../../i18n/theme'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowLeft, ArrowRight, ArrowUpRight } from 'lucide-react'
import { Brand } from '../../components/brand'
import { roles, type Role } from '../../lib/roles'
import accounts from '../../lib/demo-accounts.json'
import { getRole, localPreview } from '../../lib/session'
import { hasSupabase } from '../../lib/supabase/config'
import { login } from './actions'

const errors = ['credentials', 'config', 'profile'] as const

export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  if (await getRole()) redirect('/workspace')
  const { error } = await searchParams
  const t = await getTranslations('login')
  const common = await getTranslations('common')
  const roleText = await getTranslations('roles')
  const theme = await getTheme()
  const showRoles =
    localPreview || (hasSupabase && Boolean(process.env.KINETRIA_DEMO_PASSWORD))

  return (
    <main className="login">
      <header className="container nav">
        <Brand />
        <Link className="back-link" href="/">
          <ArrowLeft size={16} /> {common('home')}
        </Link>
        <Preferences theme={theme} />
      </header>
      <div className="login-body">
        <h1>{showRoles ? t('demo') : t('title')}</h1>
        {showRoles && <p>{localPreview ? t('local') : t('choose')}</p>}
        {error && (
          <p role="alert" className="error">
            {t(errors.find((key) => key === error) ?? 'fallback')}
          </p>
        )}
        {showRoles && (
          <form action={login} className="role-list">
            {hasSupabase ? accounts.map(account => (
              <button key={account.id} name="account" value={account.id} className="role-card">
                <span><strong>{account.name}</strong>
                  <small>{roleText(account.role as Role)}{account.category ? ' · ' + account.category : ''}</small>
                </span>
                <ArrowUpRight size={18} />
              </button>
            )) : (Object.keys(roles) as Role[]).map((key) => (
              <button key={key} name="role" value={key} className="role-card">
                <span>
                  <strong>{roleText(key)}</strong>
                  <small>{roleText(`${key}Description`)}</small>
                </span>
                <ArrowUpRight size={18} />
              </button>
            ))}
          </form>
        )}
        {hasSupabase && (
          <details className="login-credentials" open={!showRoles || Boolean(error)}>
            <summary>{t('accountLogin')}</summary>
            {showRoles && <p className="muted">{t('accountHint')}</p>}
          <form action={login} className="credentials">
            <label>
              {t('email')}
              <input
                name="email"
                type="email"
                autoComplete="username"
                required
              />
            </label>
            <label>
              {t('password')}
              <input
                name="password"
                type="password"
                autoComplete="current-password"
                required
              />
            </label>
            <button className="button button-primary">
              {t('submit')}
              <ArrowRight size={17} />
            </button>
          </form>
          </details>
        )}
        {!hasSupabase && !localPreview && <p>{t('disabled')}</p>}
      </div>
    </main>
  )
}
