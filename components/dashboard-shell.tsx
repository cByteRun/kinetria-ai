import Link from 'next/link'
import { LayoutDashboard, MessageSquare, ListFilter, GitBranch, Tags, LogOut, ChevronRight } from 'lucide-react'
import { Brand } from './brand'
import { Preferences } from './preferences'
import { logout } from '../app/login/actions'
import type { Role } from '../lib/roles'
import type { Theme } from '../i18n/settings'
import { getTranslations } from 'next-intl/server'

export async function DashboardShell({ role, view, theme, name, children }: {
  role: Role; view: string; theme: Theme; name?: string; children: React.ReactNode
}) {
  const t = await getTranslations('roles')
  const initials = name?.trim().split(/\s+/).slice(0, 2).map(part => part[0]).join('') || t(role)[0]
  const base = '/workspace/' + role
  const items = role === 'employee'
    ? [{ id: 'overview', label: 'Мой обзор', icon: LayoutDashboard }, { id: 'new', label: 'Новое обращение', icon: MessageSquare }, { id: 'registry', label: 'Мои обращения', icon: ListFilter }]
    : role === 'client' ? [{ id: 'overview', label: 'Обратная связь', icon: MessageSquare }]
    : [{ id: 'overview', label: 'Обзор', icon: LayoutDashboard }, { id: 'registry', label: 'Реестр обращений', icon: ListFilter },
      ...(role === 'admin' ? [{ id: 'routing', label: 'Маршрутизация', icon: GitBranch }, { id: 'categories', label: 'Категории', icon: Tags }] : [])]
  return <div className="crm-shell">
    <aside className="crm-sidebar">
      <div className="crm-brand"><Brand /></div>
      <p className="crm-sidebar-label">Feedback Operations</p>
      <nav aria-label="Разделы кабинета">{items.map(item => <Link key={item.id}
        href={base + '?view=' + item.id} className={view === item.id ? 'active' : ''}
        aria-current={view === item.id ? 'page' : undefined}>
        <item.icon size={19} />{item.label}
      </Link>)}</nav>
      <div className="crm-sidebar-bottom"><span className="crm-avatar" aria-hidden="true">{initials}</span>
        <div>{name && <strong>{name}</strong>}<small>{t(role)}</small></div>
        <form action={logout}><button aria-label="Выйти"><LogOut size={18} /></button></form>
      </div>
    </aside>
    <div className="crm-main">
      <header className="crm-topbar"><span>{t(role)}</span><ChevronRight size={14} />
        <strong>{items.find(item => item.id === view)?.label ?? 'Обращение'}</strong>
        <div className="crm-preferences"><Preferences theme={theme} /></div>
      </header>
      <main className="crm-content">{children}</main>
    </div>
  </div>
}
