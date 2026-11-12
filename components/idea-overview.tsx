'use client'
import Link from 'next/link'
import { useState } from 'react'
import {
  ArrowUpRight,
  ArrowRight,
  Check,
  Inbox,
  Lightbulb,
  ClockAlert,
  CircleCheck,
  Info,
  Building2,
  CalendarDays,
  Layers,
  Send,
  CheckCheck,
} from 'lucide-react'
import {
  CaseTable,
  StatusBadge,
  type RegistryRow,
} from './request-registry'
import { canViewInsights, type Role } from '../lib/roles'
import { recurringProblems, prioritizeRequests } from '../lib/insights'
import { hasResult, isDone, isOverdue } from '../lib/dashboard'

export function IdeaOverview({
  rows,
  categories,
  role,
  path,
}: {
  rows: RegistryRow[]
  categories: Record<string, string>
  role: Role
  path: string
}) {
  const [tab, setTab] = useState('attention')
  const employee = role === 'employee',
    admin = role === 'admin'
  const done = rows.filter(hasResult),
    active = rows.filter((r) => !isDone(r)),
    late = rows.filter(isOverdue),
    implemented = rows.filter((r) => r.status === 'implemented')
  const attention = rows.filter(
    (r) =>
      !isDone(r) &&
      (employee
        ? r.status === 'clarification'
        : admin
          ? !r.assignee_id
          : r.status === 'new' || isOverdue(r)),
  )
  const queue = prioritizeRequests(
    tab === 'all' ? active : tab === 'overdue' ? late : attention,
    canViewInsights(role),
  )
  const stages = [
    ['new', 'Получено', 'Категория и маршрут'],
    ['review', 'Рассмотрение', 'Ответственный назначен'],
    ['clarification', 'Уточнение', 'Диалог с автором'],
    ['in_progress', 'Действия', 'Решение выполняется'],
    ['done', 'Результат', 'Ответ опубликован'],
  ]
  const recurring = canViewInsights(role)
    ? recurringProblems(rows)[0]
    : undefined
  const filter = (value: string) => path + '?view=registry&filter=' + value
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">
            {employee
              ? 'ВАШИ ИДЕИ И ОБРАТНАЯ СВЯЗЬ'
              : admin
                ? 'НАДЁЖНЫЙ МАРШРУТ ОБРАЩЕНИЙ'
                : 'ОБРАТНАЯ СВЯЗЬ СОТРУДНИКОВ'}
          </div>
          <h1>
            {employee
              ? 'Изменения начинаются с вас.'
              : admin
                ? 'Ни одно обращение не потеряется.'
                : 'Каждое обращение — к результату.'}
          </h1>
          <p>
            {employee
              ? 'Расскажите о проблеме. Предложите улучшение. Следите за результатом.'
              : admin
                ? 'Настройте категории, ответственных и правила передачи обращений.'
                : 'Помогайте предложениям двигаться вперёд, а проблемам — находить решение.'}
          </p>
        </div>
        <Link
          className="btn primary"
          href={
            employee
              ? path + '?view=new'
              : admin
                ? path + '?view=routing'
                : filter('open')
          }
        >
          {employee
            ? 'Новое обращение'
            : admin
              ? 'Настроить маршруты'
              : 'Рассмотреть обращения'}{' '}
          <ArrowUpRight />
        </Link>
      </div>
      <div className="context-line">
        <span className="ir-flex">
          <Building2 />
          {employee
            ? 'Мой рабочий маршрут'
            : admin
              ? 'Все подразделения'
              : 'Моё направление'}{' '}
          · {rows.length} обращений
        </span>
        <span className="ir-flex">
          <CalendarDays />
          За всё время
          {rows.some((r) => r.is_demo) && (
            <span className="tiny-pill">Есть демо-данные</span>
          )}
        </span>
      </div>
      <div className="ir-metric-grid">
        {[
          {
            label: 'В работе и на рассмотрении',
            value: active.length,
            note: 'обращений ждут своего результата',
            icon: Inbox,
            filter: 'open',
            tone: '',
          },
          {
            label: employee
              ? 'Нужен ваш ответ'
              : admin
                ? 'Без ответственного'
                : 'Требуют внимания',
            value: attention.length,
            note: employee
              ? 'руководитель запросил уточнение'
              : admin
                ? 'в резервной очереди администратора'
                : `${late.length} с нарушенным сроком рассмотрения`,
            icon: ClockAlert,
            filter: employee
              ? 'clarification'
              : admin
                ? 'unassigned'
                : 'open',
            tone: attention.length ? 'amber' : '',
          },
          {
            label: 'С зафиксированным решением',
            value: rows.length
              ? Math.round((done.length / rows.length) * 100) + '%'
              : '—',
            note: `${done.length} из ${rows.length} · результат доступен автору`,
            icon: CircleCheck,
            filter: 'done',
            tone: '',
          },
          {
            label: 'Реализовано улучшений',
            value: implemented.length,
            note: 'подтверждённые действия и результаты',
            icon: Lightbulb,
            filter: 'implemented',
            tone: 'green',
          },
        ].map((m) => (
          <Link
            className="card metric"
            key={m.label}
            href={filter(m.filter)}
          >
            <div className="ir-flex ir-between">
              <span className="metric-label">{m.label}</span>
              <span className={'metric-icon ' + m.tone}>
                <m.icon />
              </span>
            </div>
            <div className={'metric-value mono ' + m.tone}>{m.value}</div>
            <div className="metric-note">{m.note}</div>
          </Link>
        ))}
      </div>
      <div className="overview-route ir-route-grid">
        <section className="card route-card">
          <div className="card-head">
            <div>
              <h2>Маршрут обращения</h2>
              <p>Понятный следующий шаг на каждом этапе</p>
            </div>
            <span className="tiny-pill">От идеи к результату</span>
          </div>
          <div className="route-stages">
            {stages.map(([s, label, note], i) => {
              const count =
                s === 'done'
                  ? done.length
                  : rows.filter((r) => r.status === s).length
              return (
                <Link className="route-stage" key={s} href={filter(s)}>
                  <div className="stage-top">
                    <span>0{i + 1}</span>
                    {i === 4 ? <CircleCheck /> : <ArrowRight />}
                  </div>
                  <div className="stage-number mono">
                    {String(count).padStart(2, '0')}
                  </div>
                  <div className="stage-name">{label}</div>
                  <div className="stage-meta">{note}</div>
                  <div className="stage-line">
                    <span
                      style={{
                        width: rows.length
                          ? Math.max(8, (count / rows.length) * 100) + '%'
                          : '0%',
                      }}
                    />
                  </div>
                </Link>
              )
            })}
          </div>
          <div className="route-foot">
            <Info />
            Решение, действия и ответ автору сохраняются в одной истории.
          </div>
        </section>
        <section className="card loop-card">
          <div>
            <div className="eyebrow">Цикл обратной связи</div>
            <h2>
              Результат есть.
              <br />
              Ответ доступен автору.
            </h2>
          </div>
          <div>
            <div className="ir-flex">
              <span className="loop-number mono">{done.length}</span>
              <span className="subtle">из {rows.length} обращений</span>
            </div>
            <div className="progress-track">
              <span
                style={{
                  width: rows.length
                    ? (done.length / rows.length) * 100 + '%'
                    : '0%',
                }}
              />
            </div>
            <div className="loop-check">
              <Check />
              Решение зафиксировано
            </div>
            <div className="loop-check">
              <Check />
              Ответ доступен в кабинете
            </div>
            <Link className="btn ghost sm" href={path + '?view=results'}>
              Посмотреть результаты <ArrowRight />
            </Link>
          </div>
        </section>
      </div>
      <div className="overview-bottom ir-bottom-grid">
        <section className="card">
          <div className="card-head">
            <div>
              <h2>
                {employee ? 'Ваш следующий шаг' : 'В фокусе внимания'}
              </h2>
              <p>
                {employee
                  ? 'Уточнения и обращения, по которым ещё нет результата'
                  : 'Начните с обращений, которым нужно ваше действие'}
              </p>
            </div>
            <Link
              href={path + '?view=registry'}
              aria-label="Открыть весь реестр"
            >
              <ArrowUpRight />
            </Link>
          </div>
          <div className="tabs">
            {[
              [
                'attention',
                employee
                  ? 'Нужен ответ'
                  : admin
                    ? 'Без назначения'
                    : 'Требуют внимания',
                attention.length,
              ],
              ['overdue', 'Просрочены', late.length],
              ['all', 'Все активные', active.length],
            ].map(([id, label, count]) => (
              <button
                className={'tab ' + (tab === id ? 'active' : '')}
                key={id}
                onClick={() => setTab(String(id))}
                aria-pressed={tab === id}
              >
                {label}
                <span>{count}</span>
              </button>
            ))}
          </div>
          <CaseTable
            rows={queue.slice(0, 4)}
            categories={categories}
            path={path}
            compact
          />
          <div className="table-foot">
            <span>
              {queue.length
                ? 'Показано ' +
                  Math.min(4, queue.length) +
                  ' из ' +
                  queue.length
                : 'Все обращения под контролем'}
            </span>
            <Link className="brand" href={path + '?view=registry'}>
              Перейти в реестр <ArrowRight />
            </Link>
          </div>
        </section>
        <div className="overview-side ir-stack">
          <section className="card">
            <div className="card-head">
              <div>
                <h2>Последние результаты</h2>
                <p>Что изменилось благодаря обратной связи</p>
              </div>
              <CircleCheck className="green" />
            </div>
            {done
              .slice()
              .sort((a, b) =>
                (b.resolved_at || b.updated_at || '').localeCompare(
                  a.resolved_at || a.updated_at || '',
                ),
              )
              .slice(0, 2)
              .map((r) => (
                <Link
                  className="result-item"
                  key={r.id}
                  href={path + '?view=registry&id=' + r.id}
                >
                  <div className="ir-flex ir-between">
                    <StatusBadge row={r} />
                    <small className="case-id">
                      {r.source_ref || 'R-' + r.number}
                    </small>
                  </div>
                  <h3>{r.title}</h3>
                  <p>{r.decision}</p>
                  <div className="ir-result-meta">
                    {r.acknowledged_at ? <CheckCheck /> : <Send />}
                    {r.acknowledged_at
                      ? 'Автор ознакомился'
                      : 'Ответ опубликован для автора'}
                  </div>
                </Link>
              ))}
            {!done.length && (
              <div className="empty">
                <CircleCheck />
                <p>Результаты появятся после рассмотрения обращений.</p>
              </div>
            )}
          </section>
          {canViewInsights(role) && (
            <section className="card repeat-card">
              <div className="ir-flex ir-between">
                <h3>Повторяющаяся тема</h3>
                <Layers className="brand" />
              </div>
              <p>
                {recurring ? recurring.tag : 'Повторяющихся тем пока нет.'}
              </p>
              {recurring && (
                <Link
                  className="ir-flex ir-between"
                  href={
                    path +
                    '?' +
                    new URLSearchParams({
                      view: 'registry',
                      category: recurring.category,
                      tag: recurring.tag,
                      kind: 'problem',
                      mode: 'groups',
                    })
                  }
                >
                  <span className="tiny-pill">
                    {recurring.rows.length} обращений в теме
                  </span>
                  <ArrowUpRight />
                </Link>
              )}
              <p className="ir-disclaimer">
                Общая категория и тег — сигнал для проверки. Связь
                дубликатов требует подтверждения.
              </p>
              <Link
                className="btn ghost sm"
                href={path + '?view=insights'}
              >
                Аналитика повторов <ArrowRight />
              </Link>
            </section>
          )}
        </div>
      </div>
    </>
  )
}
