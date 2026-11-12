import Link from 'next/link'
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
import { logout } from '../app/login/actions'
import { canViewInsights, type Role } from '../lib/roles'
import type { Theme } from '../i18n/settings'
import { getTranslations } from 'next-intl/server'
import { WorkspaceLive } from './workspace-live'
import { createClient } from '../lib/supabase/server'
import { hasSupabase } from '../lib/supabase/config'
import { terminalStatuses } from '../lib/requests'
import { ThemeToggle } from './theme-toggle'
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
      if (!r.assignee_id && !terminalStatuses.includes(r.status))
        reserveCount++
    }
  }
  const counts: Record<string, number> = {
    registry: openCount,
    results: resultCount,
    notifications: unreadCount,
    routing: reserveCount,
  }
  const items = [
    { id: 'overview', label: 'Обзор', icon: LayoutDashboard },
    {
      id: 'registry',
      label: role === 'employee' ? 'Мои обращения' : 'Обращения',
      icon: Inbox,
    },
    ...(role === 'employee'
      ? [{ id: 'new', label: 'Новое обращение', icon: PlusCircle }]
      : []),
    { id: 'results', label: 'Результаты', icon: CheckCheck },
    ...(canViewInsights(role)
      ? [
          {
            id: 'analytics',
            label: 'Аналитика',
            icon: ChartNoAxesCombined,
          },
          { id: 'insights', label: 'Повторяющиеся темы', icon: Tags },
        ]
      : []),
  ]
  const nav = (item: (typeof items)[number]) => (
    <Link
      key={item.id}
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
      { id: 'routing', label: 'Маршрутизация' },
      { id: 'categories', label: 'Категории' },
      { id: 'notifications', label: 'Уведомления' },
      { id: 'help', label: 'Как устроен маршрут' },
    ].find((i) => i.id === view)?.label || 'Обращение'
  return (
    <div className="ir-app">
      <a href="#main" className="skip-link">
        Перейти к содержимому
      </a>
      <MobileNavigation />
      <WorkspaceLive path={base} />
      <aside
        id="workspace-navigation"
        className="sidebar"
        aria-label="Основная навигация"
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
          <span className="workspace-avatar">МТ</span>
          <div>
            <strong>Модус Трейд</strong>
            <small>Рабочее пространство</small>
          </div>
          <ChevronsUpDown size={13} />
        </div>
        <nav className="ir-navigation">
          <div className="nav-group">
            <div className="eyebrow">Рабочее пространство</div>
            {items.map(nav)}
          </div>
          {role === 'admin' && (
            <div className="nav-group">
              <div className="eyebrow">Управление системой</div>
              {nav({ id: 'categories', label: 'Категории', icon: Tags })}
              {nav({
                id: 'routing',
                label: 'Маршрутизация',
                icon: GitBranch,
              })}
            </div>
          )}
          <div className="nav-group">
            <div className="eyebrow">Личное</div>
            {nav({
              id: 'notifications',
              label: 'Уведомления',
              icon: Bell,
            })}
          </div>
        </nav>
        <div className="side-bottom">
          <div className="side-manifesto">
            <strong className="brand">
              <Route size={15} /> От идеи к результату
            </strong>
            <p>
              У каждого обращения —<br />
              ответственный и понятный итог.
            </p>
            <Link className="btn ghost sm" href={base + '?view=help'}>
              Как устроен маршрут <ArrowUpRight />
            </Link>
          </div>
          <div className="side-user">
            <span className="avatar">{initials}</span>
            <div>
              <strong>{name || t(role)}</strong>
              <small>{t(role)}</small>
            </div>
            <form action={logout}>
              <button className="ir-logout" aria-label="Выйти">
                <LogOut size={16} />
              </button>
            </form>
          </div>
        </div>
      </aside>
      <div className="shell">
        <header className="topbar">
          <div className="crumbs">
            <span className="crumb-root">Рабочее пространство</span>
            <span className="crumb-root">/</span>
            <strong>{label}</strong>
          </div>
          <div className="top-actions">
            <Link
              className="btn ghost global-search muted"
              href={base + '?view=registry'}
            >
              <Search />
              <span>Найти обращение</span>
              <kbd>/</kbd>
            </Link>
            <ThemeToggle theme={theme} />
            <span className="role-select">{t(role)}</span>
            <Link
              className="icon-button"
              href={base + '?view=notifications'}
              aria-label="Уведомления"
            >
              <Bell />
              {unreadCount > 0 && <span className="notification-dot" />}
            </Link>
          </div>
        </header>
        <nav className="mobile-tabs" aria-label="Разделы кабинета">
          {items.map((item) => (
            <Link
              key={item.id}
              href={base + '?view=' + item.id}
              aria-current={view === item.id ? 'page' : undefined}
            >
              <item.icon size={20} />
              <span>
                {item.id === 'new'
                  ? 'Создать'
                  : item.id === 'insights'
                    ? 'Повторы'
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
                ? 'Видны только ваши обращения'
                : role === 'admin'
                  ? 'Доступны внутренние обращения и настройки'
                  : 'Видны обращения в вашей области ответственности'}
              <br />
              IdeaRoute · защищённое рабочее пространство
            </div>
            <span>IdeaRoute / Feedback Operations</span>
          </footer>
        </main>
      </div>
    </div>
  )
}
