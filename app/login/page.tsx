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
        <Link className="ir-home-link" href="/">
          <ArrowLeft size={15} />
          На главную
        </Link>
      </header>
      <div className="ir-login-grid">
        <section className="ir-login-story">
          <div className="eyebrow">ОБРАТНАЯ СВЯЗЬ СОТРУДНИКОВ</div>
          <h1>
            Каждое обращение —<br />к результату.
          </h1>
          <p className="ir-login-lead">
            Идеи становятся улучшениями,
            <br />а проблемы находят решение.
          </p>
          <div className="ir-login-route card">
            <div className="card-head">
              <div>
                <h2>Понятный маршрут. Видимый результат.</h2>
                <p>От первого сообщения до ответа автору</p>
              </div>
              <Route />
            </div>
            <div className="ir-login-stages">
              {[
                [Inbox, '01', 'Обращение'],
                [Sparkles, '02', 'Рассмотрение'],
                [CircleCheck, '03', 'Результат'],
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
              <Check size={15} />У каждого обращения — ответственный и следующий
              шаг
            </div>
          </div>
          <div className="ir-login-promises">
            <span>
              <LockKeyhole size={15} />
              Доступ по вашей роли
            </span>
            <span>
              <CircleCheck size={15} />
              История решений
            </span>
          </div>
        </section>
        <section className="ir-login-panel">
          <div className="ir-login-panel-head">
            <span className="workspace-avatar">МТ</span>
            <div>
              <strong>Модус Трейд</strong>
              <small>Рабочее пространство</small>
            </div>
          </div>
          <h2>Добро пожаловать</h2>
          <p className="ir-login-description">
            Войдите, чтобы предложить улучшение,
            <br />
            рассмотреть обращения и увидеть результат.
          </p>
          {error && (
            <p className="form-error" role="alert">
              {error === 'connection' ? 'Не удалось связаться с сервером. Попробуйте войти ещё раз.' : t(errors.find((k) => k === error) || 'fallback')}
            </p>
          )}
          {hasSupabase && (
            <AuthForm action="/auth/login" className="ir-login-form" pendingLabel="Входим в рабочее пространство…">
              <label>
                Рабочая почта
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
                Пароль
                <input
                  className="form-field"
                  name="password"
                  type="password"
                  placeholder="Введите пароль"
                  autoComplete="current-password"
                  required
                />
              </label>
              <button className="btn primary">
                Войти в рабочее пространство <ArrowRight size={16} />
              </button>
            </AuthForm>
          )}
          {showRoles && (
            <details className="ir-demo-login" open>
              <summary>
                <span className="tiny-pill">Демо</span> Попробовать по роли
              </summary>
              <p>Тестовые аккаунты и синтетические обращения.</p>
              <AuthForm action="/auth/login" className="ir-demo-accounts" pendingLabel="Открываем выбранный кабинет…">
                {hasSupabase
                  ? accounts
                      .filter((a) => a.role !== 'client')
                      .map((a) => (
                        <button key={a.id} name="account" value={a.id}>
                          <span>
                            <strong>{a.name}</strong>
                            <small>
                              {roleText(a.role as Role)}
                              {a.category ? ' · ' + a.category : ''}
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
            Обращения доступны в рамках вашей роли
          </p>
        </section>
      </div>
      <footer className="ir-login-footer">
        <span>IdeaRoute / Feedback Operations</span>
        <span>От идеи к результату</span>
      </footer>
    </main>
  )
}
