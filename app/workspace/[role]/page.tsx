import { getTranslations } from 'next-intl/server'
import { Preferences } from '../../../components/preferences'
import { getTheme } from '../../../i18n/theme'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import {
  BarChart3,
  GitBranch,
  LogOut,
  MessageSquare,
  ShieldCheck,
} from 'lucide-react'
import { Brand } from '../../../components/brand'
import { ChatPreview } from '../../../components/chat-preview'
import { logout } from '../../login/actions'
import { isRole } from '../../../lib/roles'
import { requireRole } from '../../../lib/session'

export default async function RoleWorkspace({
  params,
  searchParams,
}: {
  params: Promise<{ role: string }>
  searchParams: Promise<{ error?: string }>
}) {
  const active = await requireRole()
  const { role } = await params
  if (!isRole(role) || role !== active) notFound()
  const { error } = await searchParams
  const t = await getTranslations('workspace')
  const common = await getTranslations('common')
  const roleText = await getTranslations('roles')
  const theme = await getTheme()
  const board = [
    {
      label: t('new'),
      color: 'gray',
      items: [{ id: 'A-011', title: t('deadline'), owner: t('unassigned') }],
    },
    {
      label: t('inProgress'),
      color: 'purple',
      items: [{ id: 'A-003', title: t('identifiers'), owner: t('catalog') }],
    },
    {
      label: t('implemented'),
      color: 'green',
      items: [{ id: 'A-004', title: t('equipment'), owner: t('training') }],
    },
  ]

  return (
    <main className="workspace">
      <header className="site-header">
        <div className="container nav">
          <Brand />
          <span className="workspace-role">{roleText(role)}</span>
          <Preferences theme={theme} />
          <form action={logout}>
            <button className="button button-outline">
              <LogOut size={16} />
              {t('logout')}
            </button>
          </form>
        </div>
      </header>
      <div className="container workspace-body">
        {error === 'logout' && (
          <p role="alert" className="error">
            {t('logoutError')}
          </p>
        )}
        <p className="eyebrow">
          <span /> {roleText(role)}
        </p>
        {role === 'employee' && (
          <>
            <h1>{t('newRequest')}</h1>
            <ChatPreview />
          </>
        )}
        {role === 'manager' && (
          <>
            <h1>{t('board')}</h1>
            <p className="muted">{t('pilotData')}</p>
            <div className="stat-grid">
              <article>
                <MessageSquare />
                <strong>3</strong>
                <span>{t('requests')}</span>
              </article>
              <article>
                <GitBranch />
                <strong>1</strong>
                <span>{t('unassigned')}</span>
              </article>
              <article>
                <BarChart3 />
                <strong>1</strong>
                <span>{t('implemented')}</span>
              </article>
            </div>
            <div className="workspace-board">
              {board.map((column) => (
                <section key={column.label}>
                  <h2 className={`column-title ${column.color}`}>
                    <i />
                    {column.label}
                  </h2>
                  {column.items.map((item) => (
                    <article key={item.id} className="mock-card">
                      <small>{item.id}</small>
                      <b>{item.title}</b>
                      <span>{item.owner}</span>
                    </article>
                  ))}
                </section>
              ))}
            </div>
            <figure className="summary">
              <figcaption>{t('distribution')}</figcaption>
              {board.map((column) => (
                <div key={column.label}>
                  <span>{column.label}</span>
                  <meter min={0} max={3} value={column.items.length} />
                  <strong>{column.items.length}</strong>
                </div>
              ))}
            </figure>
          </>
        )}
        {role === 'handler' && (
          <>
            <h1>{t('assignments')}</h1>
            <p className="muted">{t('demoData')}</p>
            <section className="workspace-panel">
              <span className="pill">{t('inProgress')} · A-003</span>
              <h2>{t('identifiers')}</h2>
              <p>{t('handlerText')}</p>
            </section>
          </>
        )}
        {role === 'admin' && (
          <>
            <h1>{t('routing')}</h1>
            <p className="muted">{t('demoRules')}</p>
            <section className="workspace-panel">
              <h2>{t('categories')}</h2>
              <dl>
                <div>
                  <dt>{t('data')}</dt>
                  <dd>{t('catalog')}</dd>
                </div>
                <div>
                  <dt>{t('responsiveness')}</dt>
                  <dd>{t('department')}</dd>
                </div>
                <div>
                  <dt>{t('noRule')}</dt>
                  <dd>{t('fallbackQueue')}</dd>
                </div>
              </dl>
            </section>
          </>
        )}
        {role === 'client' && (
          <>
            <h1>{t('client')}</h1>
            <section className="workspace-panel">
              <ShieldCheck />
              <h2>{t('clientFeedback')}</h2>
              <p>{t('clientText')}</p>
              <Link href="/" className="button button-outline">
                {common('home')}
              </Link>
            </section>
          </>
        )}
      </div>
    </main>
  )
}
