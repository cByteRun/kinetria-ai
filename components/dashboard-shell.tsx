import { getColorTheme } from '../i18n/theme'
import { WorkspaceNavLink, WorkspaceCrumbs } from './workspace-navigation'
import { LogoMark } from './logo-mark'
import Link from 'next/link'
import { CommandPalette } from './command-palette'
import {
  LayoutDashboard,
  Inbox,
  GitBranch,
  Tags,
  LogOut,
  Route,
  CheckCheck,
  ChartNoAxesCombined,
  Bell,
  PlusCircle,
  ArrowUpRight,
  LockKeyhole,
  Search,
  ChevronsUpDown,
  Send,
  Settings2,
} from 'lucide-react'
import { AuthForm } from './auth-form'
import { canViewInsights, type Role } from '../lib/roles'
import type { Theme } from '../i18n/settings'
import { getTranslations } from 'next-intl/server'
import { WorkspaceLive } from './workspace-live'
import { createClient } from '../lib/supabase/server'
import { hasSupabase } from '../lib/supabase/config'
import { localPreview } from '../lib/session'
import { terminalStatuses } from '../lib/requests'
import { Preferences } from './preferences'
import { MobileNavigation } from './mobile-navigation'

export async function DashboardShell({
  role,
  name,
  theme,
  children,
}: {
  role: Role
  theme: Theme
  name?: string
  children: React.ReactNode
}) {
  const [ui, colorTheme, common] = await Promise.all([getTranslations('ui'), getColorTheme(), getTranslations('common')])

  const t = await getTranslations('roles')
  const entry = await getTranslations('entryFlow')
  const shell = await getTranslations('dashboardShell')
  const telegramConfigured = Boolean(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_BOT_USERNAME)
  const canSwitchRole = localPreview || (hasSupabase && Boolean(process.env.KINETRIA_DEMO_PASSWORD))
  const initials =
    name
      ?.trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0])
      .join('') || t(role)[0]
  const base = '/workspace/' + role
  let openCount = 0,
    resultCount = 0,
    unreadCount = 0,
    reserveCount = 0
  if (hasSupabase && role !== 'client') {
    const db = await createClient()
    const [requests, receipts] = await Promise.all([
      db.from('requests').select('id,status,version,decision,assignee_id'),
      db.from('request_receipts').select('request_id,seen_version'),
    ])
    const seen = new Map(
      (receipts.data || []).map((r) => [r.request_id, r.seen_version]),
    )
    for (const r of requests.data || []) {
      if (!terminalStatuses.includes(r.status)) openCount++
      if (terminalStatuses.includes(r.status) && r.decision?.trim())
        resultCount++
      if ((seen.get(r.id) || 0) < r.version) unreadCount++
      if (!r.assignee_id && !terminalStatuses.includes(r.status)) reserveCount++
    }
  }
  const counts: Record<string, number> = {
    registry: openCount,
    results: resultCount,
    notifications: unreadCount,
    routing: reserveCount,
  }
  const items = [
    { id: 'overview', label: ui('overview'), icon: LayoutDashboard },
    {
      id: 'registry',
      label: role === 'employee' ? ui('myRequests') : ui('requests'),
      icon: Inbox,
    },
    { id: 'lifecycle', label: shell('lifecycle'), icon: GitBranch },
    ...(role === 'employee'
      ? [{ id: 'new', label: ui('newRequest'), icon: PlusCircle }]
      : []),
    { id: 'results', label: ui('results'), icon: CheckCheck },
    ...(canViewInsights(role)
      ? [
          {
            id: 'analytics',
            label: ui('analytics'),
            icon: ChartNoAxesCombined,
          },
          { id: 'insights', label: ui('recurringTopics'), icon: Tags },
        ]
      : []),
  ]
  const nav = (item: (typeof items)[number]) => {
    return (
      <WorkspaceNavLink
        key={item.id} view={item.id}
        href={item.id === 'lifecycle' ? base + '?view=registry&mode=board' : base + '?view=' + item.id}
      >
        <item.icon />
        <span>{item.label}</span>
        {Boolean(counts[item.id]) && <span className="nav-count">{counts[item.id]}</span>}
      </WorkspaceNavLink>
    )
  }
  return (
    <div className="ir-app">
      <a href="#main" className="skip-link">
        {ui('skipToContent')}
      </a>
      <MobileNavigation />
      <WorkspaceLive path={base} />
      <aside
        id="workspace-navigation"
        className="sidebar"
        aria-label={ui('mainNavigation')}
      >
        <div className="brand-lockup">
          <Link className="brand-mark" href="/" aria-label={common('brand')}><LogoMark size={28} /></Link>
          <Link href={base + '?view=overview'}>IdeaRoute</Link>
        </div>
        <div className="workspace">
          <span className="workspace-avatar">{ui('mt')}</span>
          <div>
            <strong>{ui('modusTrade')}</strong>
            <small>{ui('workspace')}</small>
          </div>
          <ChevronsUpDown size={13} />
        </div>
        <nav className="ir-navigation">
          <div className="nav-group">
            <div className="eyebrow">{ui('workspace')}</div>
            {items.map(nav)}
          </div>
          {role === 'admin' && (
            <div className="nav-group">
              <div className="eyebrow"><Settings2 size={12} /> {shell('settings')}</div>
              {nav({ id: 'categories', label: ui('categories'), icon: Tags })}
              {nav({
                id: 'routing',
                label: ui('routing'),
                icon: GitBranch,
              })}
            </div>
          )}
          <div className="nav-group">
            <div className="eyebrow">{shell('integrations')}</div>
            {nav({ id: 'help', label: shell('telegramIntegration'), icon: Send })}
          </div>
          <div className="nav-group">
            <div className="eyebrow">{ui('personal')}</div>
            {nav({
              id: 'notifications',
              label: ui('notifications'),
              icon: Bell,
            })}
          </div>
        </nav>
        <div className="side-bottom">
          <div className="side-manifesto">
            <strong className="brand">
              <Route size={15} /> {ui('fromIdeaToOutcome')}
            </strong>
            <p>
              {ui('everyRequestHas')}
              <br />
              {ui('anOwnerAndAClearOutcome')}
            </p>
            <Link className="btn ghost sm" href={base + '?view=help'}>
              {ui('howRoutingWorks')}
              <ArrowUpRight />
            </Link>
          </div>
          <div className="side-user">
            <span className="avatar">{initials}</span>
            <div>
              <strong>{name || t(role)}</strong>
              <small>{t(role)}</small>
            </div>
            <AuthForm action="/auth/logout" pendingLabel={ui('signingOut')}>
              <button className="ir-logout" aria-label={ui('signOut')}>
                <LogOut size={16} />
              </button>
            </AuthForm>
          </div>
        </div>
      </aside>
      <div className="shell">
        <header className="topbar">
          <WorkspaceCrumbs base={base} employee={role === 'employee'} />
          <div className="top-actions">
            <form className="shell-search" action={base} role="search">
              <input type="hidden" name="view" value="registry" />
              <Search size={16} aria-hidden="true" />
              <input name="q" aria-label={ui('findARequest')} placeholder={ui('findARequest')} />
              <button type="submit" aria-label={ui('findARequest')}><ArrowUpRight size={16} /></button>
            </form>
            <Link className="telegram-status" href={base + '?view=help'} title={shell(telegramConfigured ? 'telegramConfigured' : 'telegramNotConfigured')}>
              <Send size={15} /><span>{shell(telegramConfigured ? 'telegramConfigured' : 'telegramNotConfigured')}</span>
              <i className={telegramConfigured ? 'configured' : ''} aria-hidden="true" />
            </Link>
            <CommandPalette role={role} />
            <Preferences theme={theme} colorTheme={colorTheme} compact />
            <details className="shell-profile">
              <summary aria-label={shell('profile')} title={name || t(role)}><span className="avatar">{initials}</span></summary>
              <div className="shell-profile-menu"><strong>{name || t(role)}</strong><small>{t(role)}</small>
                <AuthForm action="/auth/logout" pendingLabel={ui('signingOut')}><button className="btn"><LogOut size={15} />{ui('signOut')}</button></AuthForm>
              </div>
            </details>
            {canSwitchRole ? <Link className="role-select" href="/login" aria-label={entry('switchRole')}>
              {entry('switchRole')} <ChevronsUpDown size={13} />
            </Link> : <span className="role-select">{t(role)}</span>}
            <Link
              className="icon-button"
              href={base + '?view=notifications'}
              aria-label={ui('notifications')}
            >
              <Bell />
              {unreadCount > 0 && <span className="notification-dot" />}
            </Link>
          </div>
        </header>
        <nav className="mobile-tabs" aria-label={ui('workspaceSections')}>
          {[
            ...items.filter((item) =>
              ['overview', 'registry', 'new', 'results'].includes(item.id),
            ),
            { id: 'notifications', label: ui('notifications'), icon: Bell },
          ].map((item) => (
            <WorkspaceNavLink key={item.id} view={item.id} mobile href={base + '?view=' + item.id}>
              <item.icon size={20} />
              <span>
                {item.id === 'new'
                  ? ui('create')
                  : item.id === 'insights'
                    ? ui('recurrence')
                    : item.id === 'registry'
                      ? ui('requests')
                      : item.id === 'notifications'
                        ? ui('updates')
                        : item.label}
              </span>
            </WorkspaceNavLink>
          ))}
        </nav>
        <main id="main" className="content">
          {children}
          <footer className="footer-note">
            <div>
              <LockKeyhole size={13} />{' '}
              {role === 'employee'
                ? ui('onlyYourRequestsAreVisible')
                : role === 'admin'
                  ? ui('internalRequestsAndSettingsAreAvailable')
                  : ui('requestsWithinYourAreaOfResponsibilityAreVisible')}
              <br />
              {ui('idearouteSecureWorkspace')}
            </div>
            <span>IdeaRoute / {ui('feedbackOperations')}</span>
          </footer>
        </main>
      </div>
    </div>
  )
}
