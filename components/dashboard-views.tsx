'use client'
import Link from 'next/link'
import { Heading } from './workspace-heading'
import { RecurringAnalytics } from './recurring-analytics'
import { useState } from 'react'
import {
  CheckCheck,
  CircleCheck,
  Clock3,
  ArrowUpRight,
  Info,
} from 'lucide-react'
import { FeedbackNotifications } from './feedback-notifications'
import { dateLabel, hasResult, isDone, isOverdue } from '../lib/dashboard'
import {
  StatusBadge,
  type RegistryRow,
  requestNumber,
} from './request-registry'

export function DashboardViews({
  rows,
  categories,
  path,
  view,
  receipts = {},
}: {
  rows: RegistryRow[]
  categories: Record<string, string>
  path: string
  view: string
  receipts?: Record<string, number>
}) {
  const [period, setPeriod] = useState('all')
  const data = rows.filter(
    (r) =>
      period === 'all' ||
      (r.created_at &&
        Date.parse(r.created_at) >=
          Date.now() - Number(period) * 86400000),
  )
  const done = data.filter(hasResult).sort((a, b) =>
    Date.parse(b.resolved_at || b.updated_at || '') - Date.parse(a.resolved_at || a.updated_at || ''))
  const registryLink = (params: Record<string, string>) =>
    path +
    '?' +
    new URLSearchParams({ view: 'registry', period, ...params }).toString()
  const avg = (field: 'first_response_at' | 'resolved_at') => {
    const values = data
      .filter((r) => r.created_at && r[field])
      .map((r) =>
        Math.max(
          0,
          (Date.parse(r[field]!) - Date.parse(r.created_at!)) / 86400000,
        ),
      )
    return values.length
      ? (values.reduce((a, b) => a + b, 0) / values.length).toLocaleString(
          'ru-RU',
          { maximumFractionDigits: 1 },
        ) + ' д.'
      : '—'
  }
  if (view === 'insights')
    return (
      <RecurringAnalytics
        rows={data}
        categories={categories}
        path={path}
        period={period}
        setPeriod={setPeriod}
      />
    )
  if (view === 'help')
    return (
      <>
        <Heading
          title="Как устроен маршрут"
          description="От обращения сотрудника до решения и обратной связи."
        />
        <section className="card help-section">
          <h2>У каждого обращения есть следующий шаг</h2>
          <ol>
            <li>
              Сотрудник регистрирует обращение вручную или с помощью ИИ.
              Перед отправкой проверяет карточку.
            </li>
            <li>
              Категория определяет ответственного и срок. Если маршрут
              выключен или отсутствует, обращение попадает в резервную
              очередь администратора.
            </li>
            <li>
              Руководитель или ответственный начинает рассмотрение,
              запрашивает уточнения и фиксирует действия.
            </li>
            <li>
              Ответ сотрудника возвращает обращение на рассмотрение.
              Передача в работу сохраняет цикл открытым.
            </li>
            <li>
              Итоговое решение доступно автору в результатах и
              уведомлениях. Автор может отметить ознакомление.
            </li>
          </ol>
        </section>
        <section className="card help-section ir-section-gap">
          <h2>Данные и доступ</h2>
          <p>
            Авторизация, права доступа, обращения, история, комментарии,
            сроки и ознакомление хранятся в Supabase. Сотрудник видит свои
            обращения, руководитель — категории своего направления,
            ответственный — назначенные ему, администратор — общий реестр.
            Карточки из синтетического датасета отмечены «Демо». Метрики
            рассчитываются по доступным карточкам. Уведомления доступны
            внутри приложения; внешняя доставка писем не подключена.
            Совпадающие тематические теги внутри категории помогают найти
            тему для проверки и не являются автоматическим определением
            дубликатов.
          </p>
        </section>
      </>
    )
  if (view === 'notifications')
    return <FeedbackNotifications rows={rows} receipts={receipts} path={path} />
  if (view === 'results')
    return (
      <>
        <Heading
          title="Результаты"
          description="Решения, выполненные действия и обратная связь авторам."
        />
        <section className="card">
          <div className="card-head">
            <div>
              <h2>Обращения с зафиксированным решением</h2>
              <p>
                {done.length} из {data.length} обращений
              </p>
            </div>
            <CircleCheck className="green" />
          </div>
          {done.map((r) => (
            <Link
              className="result-item"
              key={r.id}
              href={path + '?view=registry&id=' + r.id}
            >
              <div className="ir-flex ir-between">
                <StatusBadge row={r} />
                <small className="case-id">
                  {requestNumber(r)} · {dateLabel(r.resolved_at)}{' '}
                  {r.is_demo && '· Демо'}
                </small>
              </div>
              <h3>{r.title}</h3>
              <p className="result-decision">{r.decision}</p>
              {r.next_step && <p>Действия: {r.next_step}</p>}
              <div className="ir-result-meta">
                <CheckCheck />
                {r.acknowledged_at
                  ? 'Автор ознакомился ' + dateLabel(r.acknowledged_at)
                  : 'Решение готово · автор ещё не подтвердил ознакомление'}
                <span className="result-open">{path.endsWith('/employee') && !r.acknowledged_at ? 'Прочитать и подтвердить' : 'Открыть результат'} <ArrowUpRight /></span>
              </div>
            </Link>
          ))}
          {!done.length && (
            <div className="empty">
              <CircleCheck />
              <h3>Результаты ещё впереди</h3>
              <p>
                Здесь появятся обращения с итоговым статусом и
                содержательным решением.
              </p>
            </div>
          )}
        </section>
      </>
    )
  return (
    <>
      <Heading
        title="Аналитика"
        description="Что меняется благодаря обратной связи сотрудников."
        action={
          <select
            className="filter-select"
            aria-label="Период аналитики"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
          >
            <option value="all">За всё время</option>
            <option value="7">За 7 дней</option>
            <option value="30">За 30 дней</option>
            <option value="90">За 90 дней</option>
          </select>
        }
      />
      <div className="ir-metric-grid">
        {[
          [
            'До рассмотрения',
            avg('first_response_at'),
            'Среднее время от регистрации до начала рассмотрения',
            Clock3,
          ],
          [
            'До результата',
            avg('resolved_at'),
            'Среднее время от регистрации до итогового статуса',
            CircleCheck,
          ],
          [
            'Цикл завершён',
            data.length
              ? Math.round((done.length / data.length) * 100) + '%'
              : '—',
            `${done.length} обращений с решением для автора`,
            CheckCheck,
          ],
          [
            'Просрочено',
            data.filter(isOverdue).length,
            'Активные обращения с истёкшим сроком',
            Clock3,
          ],
        ].map(([title, value, note, Icon]) => {
          const I = Icon as typeof Clock3
          return (
            <section className="card metric" key={String(title)}>
              <div className="ir-flex ir-between">
                <span className="metric-label">{String(title)}</span>
                <I />
              </div>
              <div className="metric-value">{String(value)}</div>
              <p className="metric-note">{String(note)}</p>
            </section>
          )
        })}
      </div>
      <Link
        className="card recurrence-entry"
        href={path + '?view=insights'}
      >
        <div>
          <h2>Повторяющиеся темы</h2>
          <p>Частота, доля проблем и результаты по темам</p>
        </div>
        <ArrowUpRight />
      </Link>
      <div className="settings-grid">
        <section className="card">
          <div className="card-head">
            <div>
              <h2>Темы обращений</h2>
              <p>Категории с наибольшим числом обращений</p>
            </div>
          </div>
          <div className="detail-block">
            {Object.entries(categories)
              .map(([id, name]) => ({
                id,
                name,
                count: data.filter((r) => r.category_id === id).length,
              }))
              .filter((c) => c.count)
              .sort((a, b) => b.count - a.count)
              .map((c) => (
                <div className="chart-bar" key={c.id}>
                  <Link href={registryLink({ category: c.id })}>
                    {c.name}
                  </Link>
                  <div className="chart-track">
                    <span
                      style={{
                        width:
                          (c.count / Math.max(1, data.length)) * 100 + '%',
                      }}
                    />
                  </div>
                  <strong>{c.count}</strong>
                </div>
              ))}
          </div>
          <p className="stat-definition">
            Частота категории помогает определить тему для проверки.
          </p>
        </section>
        <section className="card">
          <div className="card-head">
            <div>
              <h2>Результаты рассмотрения</h2>
              <p>По доступным обращениям выбранного периода</p>
            </div>
          </div>
          <div className="detail-block">
            {[
              ['implemented', 'Реализовано'],
              ['rejected', 'Отклонено'],
              ['closed', 'Закрыто с ответом'],
              ['open', 'Остаются в работе'],
            ].map(([id, label]) => {
              const count = data.filter((r) =>
                id === 'open' ? !isDone(r) : r.status === id,
              ).length
              return (
                <div className="chart-bar" key={id}>
                  <Link href={registryLink({ filter: id })}>{label}</Link>
                  <div className="chart-track green-track">
                    <span
                      style={{
                        width:
                          (count / Math.max(1, data.length)) * 100 + '%',
                      }}
                    />
                  </div>
                  <strong>{count}</strong>
                </div>
              )
            })}
          </div>
          <p className="stat-definition">
            <Info size={13} /> Передача в работу ещё не завершает цикл.
            Демо-карточки учитываются в расчёте и отмечены в реестре.
          </p>
        </section>
      </div>
    </>
  )
}
export { Heading } from './workspace-heading'
