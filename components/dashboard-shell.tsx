import { TELEGRAM_CHANNEL_INVITE_URL } from '../lib/telegram-links'
import { getColorTheme } from '../i18n/theme'
import { WorkspaceNavLink, WorkspaceCrumbs } from './workspace-navigation'
import { LogoMark } from './logo-mark'
import Link from 'next/link'
import { CommandPalette, type SearchRequest } from './command-palette'
import previewRequests from '../lib/demo-requests.json'
import previewTopics from '../lib/demo-topic-requests.json'
import {
  UsersRound,
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
  Radio,
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
import { GlobalHeader } from './global-header'
import { MobileNavigation } from './mobile-navigation'
import { TourStartButton } from './tour-provider'

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
  const canSwitchRole = localPreview || (hasSupabase && Boolean(process.env.KINETRIA_DEMO_PASSWORD))
  const initials =
    name
      ?.trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0])
      .join('') || t(role)[0]
  const base = '/workspace/' + role
  let searchRequests: SearchRequest[] = localPreview ? [...previewRequests, ...previewTopics].map((r, i) => ({ id: r.id, title: r.title, number: i + 1, source_ref: r.id })) : []
  let openCount = 0,
    resultCount = 0,
    unreadCount = 0,
    reserveCount = 0
  if (hasSupabase && role !== 'client') {
    const db = await createClient()
    const [requests, receipts] = await Promise.all([
      db.from('requests').select('id,number,source_ref,title,status,version,decision,assignee_id'),
      db.from('request_receipts').select('request_id,seen_version'),
    ])
    searchRequests = (requests.data || []).map(({ id, number, source_ref, title }) => ({ id, number, source_ref, title }))
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
    { id: 'portal', label: ui('clientPortal'), icon: Inbox },
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
              <div className="eyebrow">{shell('settings')}</div>
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
            {role !== 'client' && <a className="nav-link" href={TELEGRAM_CHANNEL_INVITE_URL} target="_blank" rel="noreferrer"><Radio size={18} aria-hidden="true" /><span>{shell('telegramChannel')}</span><ArrowUpRight size={14} aria-hidden="true" /></a>}
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
          <TourStartButton reset />
          <Link className="nav-link side-guide" href={base + '?view=help'}>
            <Route size={18} /><span>{ui('fromIdeaToOutcome')}</span>
          </Link>
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
        <GlobalHeader theme={theme} colorTheme={colorTheme} context={<WorkspaceCrumbs base={base} employee={role === 'employee'} />} search={
          <div className="header-primary">
            <form className="shell-search" action={base} role="search">
              <input type="hidden" name="view" value="registry" />
              <Search size={16} aria-hidden="true" />
              <input name="q" aria-label={ui('findARequest')} placeholder={ui('findARequest')} />
              <button type="submit" aria-label={ui('findARequest')}><ArrowUpRight size={16} /></button>
            </form>
            <span className="search-divider" aria-hidden="true" />
            <CommandPalette role={role} requests={searchRequests} />
          </div>
        }>
          <div className="top-actions">
            <details className="shell-profile">
              <summary aria-label={shell('profile')} title={name || t(role)}><span className="avatar">{initials}</span><span className="profile-context"><strong>{name || t(role)}</strong><small>{t(role)}</small></span></summary>
              <div className="shell-profile-menu"><strong>{name || t(role)}</strong><small>{t(role)}</small>
                {canSwitchRole && <Link className="btn" href="/login">{entry('switchRole')}</Link>}
                <Link className="btn" href={base + '?view=profile'}>{shell('profile')}</Link>
                <AuthForm action="/auth/logout" pendingLabel={ui('signingOut')}><button className="btn"><LogOut size={15} />{ui('signOut')}</button></AuthForm>
              </div>
            </details>
            <Link
              className="icon-button"
              href={base + '?view=notifications'}
              aria-label={ui('notifications')}
            >
              <Bell />
              {unreadCount > 0 && <span className="notification-dot" />}
            </Link>
          </div>
        </GlobalHeader>
        <nav className="mobile-tabs" aria-label={ui('workspaceSections')}>
          {items.filter(item => ['overview', 'registry', 'new', 'results'].includes(item.id)).map(item => (
            <WorkspaceNavLink key={item.id} view={item.id} mobile href={base + '?view=' + item.id}>
              <item.icon size={20} /><span>{item.id === 'new' ? ui('create') : item.id === 'registry' ? ui('requests') : item.label}</span>
            </WorkspaceNavLink>
          ))}
          {role !== 'employee' && <WorkspaceNavLink view="notifications" mobile href={base + '?view=notifications'}><Bell size={20} /><span>{ui('updates')}</span></WorkspaceNavLink>}
          <MobileNavigation>
            <TourStartButton reset />
            {items.map(nav)}
            {role === 'admin' && <>{nav({ id: 'categories', label: ui('categories'), icon: Tags })}{nav({ id: 'routing', label: ui('routing'), icon: GitBranch })}</>}
            {nav({ id: 'notifications', label: ui('notifications'), icon: Bell })}
            {nav({ id: 'help', label: ui('fromIdeaToOutcome'), icon: Route })}
            {role !== 'client' && <a className="nav-link" href={TELEGRAM_CHANNEL_INVITE_URL} target="_blank" rel="noreferrer"><Radio size={18} /><span>{shell('telegramChannel')}</span></a>}
            <Link className="nav-link" href={base + '?view=profile'}><UsersRound size={18}/><span>{shell('profile')}</span></Link>
            {canSwitchRole && <Link className="nav-link" href="/login"><UsersRound size={18}/><span>{entry('switchRole')}</span></Link>}
            <AuthForm action="/auth/logout" pendingLabel={ui('signingOut')}><button className="nav-link"><LogOut size={18}/>{ui('signOut')}</button></AuthForm>
          </MobileNavigation>
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
