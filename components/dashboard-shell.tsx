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
} from 'lucide-react'
import { AuthForm } from './auth-form'
import { canViewInsights, type Role } from '../lib/roles'
import type { Theme } from '../i18n/settings'
import { getTranslations } from 'next-intl/server'
import { WorkspaceLive } from './workspace-live'
import { createClient } from '../lib/supabase/server'
import { hasSupabase } from '../lib/supabase/config'
import { terminalStatuses } from '../lib/requests'
import { Preferences } from './preferences'
import { MobileNavigation } from './mobile-navigation'

export async function DashboardShell({
  role,
  view,
  name,
  theme,
  children,
}: {
  role: Role
  view: string
  theme: Theme
  name?: string
  children: React.ReactNode
}) {
  const ui = await getTranslations('ui')

  const t = await getTranslations('roles')
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
  const nav = (item: (typeof items)[number]) => (
    <Link
      key={item.id}
      prefetch={false}
      href={base + '?view=' + item.id}
      className={'nav-link ' + (view === item.id ? 'active' : '')}
      aria-current={view === item.id ? 'page' : undefined}
    >
      <item.icon />
      <span>{item.label}</span>
      {Boolean(counts[item.id]) && (
        <span className="nav-count">{counts[item.id]}</span>
      )}
    </Link>
  )
  const label =
    [
      ...items,
      { id: 'routing', label: ui('routing') },
      { id: 'categories', label: ui('categories') },
      { id: 'notifications', label: ui('notifications') },
      { id: 'help', label: ui('howRoutingWorks') },
    ].find((i) => i.id === view)?.label || ui('request')
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
        <Link className="brand-lockup" href={base}>
          <span className="brand-mark">
            <Route />
          </span>
          <span>
            Idea<span style={{ fontWeight: 500 }}>Route</span>
          </span>
        </Link>
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
              <div className="eyebrow">{ui('systemManagement')}</div>
              {nav({ id: 'categories', label: ui('categories'), icon: Tags })}
              {nav({
                id: 'routing',
                label: ui('routing'),
                icon: GitBranch,
              })}
            </div>
          )}
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
          <div className="crumbs">
            <span className="crumb-root">{ui('workspace')}</span>
            <span className="crumb-root">/</span>
            <strong>{label}</strong>
          </div>
          <div className="top-actions">
            <Link
              className="btn ghost global-search muted"
              href={base + '?view=registry'}
            >
              <Search />
              <span>{ui('findARequest')}</span>
              <kbd>/</kbd>
            </Link>
            <CommandPalette role={role} />
            <Preferences theme={theme} compact />
            <span className="role-select">{t(role)}</span>
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
            <Link
              key={item.id}
              prefetch={false}
              href={base + '?view=' + item.id}
              aria-current={view === item.id ? 'page' : undefined}
            >
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
            </Link>
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
