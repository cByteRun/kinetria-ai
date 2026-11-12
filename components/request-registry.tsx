'use client'
import Link from 'next/link'
import { useState } from 'react'
import {
  normalizeTopic,
  recurringProblems,
  prioritizeRequests,
} from '../lib/insights'
import { useSearchParams } from 'next/navigation'
import {
  Search,
  Inbox,
  ArrowUpRight,
  Download,
  List,
  Columns3,
  Layers,
  Lightbulb,
  MessageSquareWarning,
  HeartHandshake,
  ClockAlert,
} from 'lucide-react'
import {
  requestKindLabels,
  statuses,
  type RequestStatus,
} from '../lib/requests'
import {
  dateLabel,
  hasResult,
  isDone,
  isOverdue,
  statusNames,
  today,
} from '../lib/dashboard'

export type RegistryRow = {
  id: string
  number: number
  source_ref: string | null
  title: string
  status: RequestStatus
  category_id: string
  assignee_id: string | null
  updated_at?: string
  description?: string
  next_step?: string | null
  decision?: string | null
  kind: keyof typeof requestKindLabels
  sentiment: number | null
  department?: string
  priority?: string
  due_at?: string | null
  created_at?: string
  first_response_at?: string | null
  resolved_at?: string | null
  acknowledged_at?: string | null
  is_demo?: boolean
  version?: number
  tags?: string[]
}
export const requestNumber = (row: RegistryRow) =>
  row.source_ref ?? 'R-' + String(row.number).padStart(3, '0')
export function StatusBadge({ row }: { row: RegistryRow }) {
  return (
    <span
      className={
        'badge ' +
        ((
          { clarification: 'waiting', in_progress: 'progress' } as Record<
            string,
            string
          >
        )[row.status] || row.status)
      }
    >
      {statusNames[row.status]}
    </span>
  )
}
export function DueLabel({ row }: { row: RegistryRow }) {
  return (
    <span
      className={
        'due ' +
        (isOverdue(row)
          ? 'red'
          : row.due_at?.slice(0, 10) === today()
            ? 'amber'
            : 'muted')
      }
    >
      {isOverdue(row) && <ClockAlert size={14} />}{' '}
      {isDone(row)
        ? dateLabel(row.resolved_at)
        : isOverdue(row)
          ? Math.max(
              1,
              Math.ceil(
                (Date.parse(today()) - Date.parse(row.due_at!)) / 86400000,
              ),
            ) + ' д. просрочки'
          : row.due_at?.slice(0, 10) === today()
            ? 'Сегодня'
            : dateLabel(row.due_at)}
    </span>
  )
}
export function CaseTable({
  rows,
  categories,
  path,
  compact = false,
}: {
  rows: RegistryRow[]
  categories: Record<string, string>
  path: string
  compact?: boolean
}) {
  return (
    <div className="table-scroll">
      <table className="case-table">
        <thead>
          <tr>
            <th>Обращение</th>
            <th>Статус</th>
            {!compact && (
              <>
                <th>Подразделение</th>
                <th>Приоритет</th>
              </>
            )}
            <th>Срок</th>
            <th aria-label="Открыть" />
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td data-label="Обращение">
                <div className="ir-case-cell">
                  <span
                    className={
                      'type-icon ' +
                      (row.kind === 'idea'
                        ? 'idea'
                        : row.kind === 'praise'
                          ? 'positive'
                          : '')
                    }
                  >
                    {row.kind === 'idea' ? (
                      <Lightbulb />
                    ) : row.kind === 'praise' ? (
                      <HeartHandshake />
                    ) : (
                      <MessageSquareWarning />
                    )}
                  </span>
                  <div>
                    <Link
                      className="case-title"
                      href={path + '?view=registry&id=' + row.id}
                    >
                      {row.title}
                    </Link>
                    <div className="case-caption">
                      {requestNumber(row)} · {categories[row.category_id]}{' '}
                      {row.is_demo && (
                        <span className="tiny-pill">Демо</span>
                      )}
                    </div>
                  </div>
                </div>
              </td>
              <td data-label="Статус">
                <StatusBadge row={row} />
                {row.status === 'clarification' && (
                  <div className="case-caption">Ждём ответ автора</div>
                )}
                {!row.assignee_id && !isDone(row) && (
                  <div className="case-caption">Резервная очередь</div>
                )}
              </td>
              {!compact && (
                <>
                  <td data-label="Подразделение">
                    {row.department || '—'}
                  </td>
                  <td data-label="Приоритет">
                    <span
                      className={
                        row.priority === 'high' ? 'amber' : 'muted'
                      }
                    >
                      {row.priority === 'high'
                        ? 'Высокий'
                        : row.priority === 'low'
                          ? 'Низкий'
                          : 'Обычный'}
                    </span>
                  </td>
                </>
              )}
              <td data-label="Срок">
                <DueLabel row={row} />
              </td>
              <td className="case-open">
                <Link
                  className="icon-button"
                  href={path + '?view=registry&id=' + row.id}
                  aria-label={'Открыть ' + requestNumber(row)}
                >
                  <ArrowUpRight />
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!rows.length && (
        <div className="empty">
          <Inbox />
          <h3>Обращений пока нет</h3>
          <p>Измените фильтры или зарегистрируйте новое обращение.</p>
        </div>
      )}
    </div>
  )
}
function RegistryFilters({
  rows,
  categories,
  path,
  showRecurrence = false,
}: {
  showRecurrence?: boolean
  rows: RegistryRow[]
  categories: Record<string, string>
  path: string
}) {
  const params = useSearchParams()
  const [query, setQuery] = useState(params.get('q') || ''),
    [status, setStatus] = useState(params.get('filter') || ''),
    [category, setCategory] = useState(params.get('category') || ''),
    [department, setDepartment] = useState(''),
    [deadline, setDeadline] = useState(''),
    [mode, setMode] = useState(
      showRecurrence ? params.get('mode') || 'groups' : 'table',
    ),
    [sort, setSort] = useState(showRecurrence ? 'recurrence' : 'priority')
  const tag = params.get('tag') || ''
  const kind = params.get('kind') || ''
  const period = params.get('period') || 'all'
  const filtered = rows.filter(
    (r) =>
      (!tag ||
        (r.tags || []).some(
          (t) => normalizeTopic(t) === normalizeTopic(tag),
        )) &&
      (!kind || r.kind === kind) &&
      (period === 'all' ||
        (r.created_at &&
          Date.parse(r.created_at) >=
            Date.now() - Number(period) * 86400000)) &&
      (!status ||
        (status === 'open'
          ? !isDone(r)
          : status === 'done'
            ? hasResult(r)
            : status === 'overdue'
              ? isOverdue(r)
              : status === 'unassigned'
                ? !r.assignee_id && !isDone(r)
                : r.status === status)) &&
      (!category || r.category_id === category) &&
      (!department || r.department === department) &&
      (!deadline ||
        (deadline === 'overdue'
          ? isOverdue(r)
          : r.due_at?.slice(0, 10) === today())) &&
      [
        r.title,
        r.description,
        r.decision,
        r.next_step,
        requestNumber(r),
        categories[r.category_id],
        r.department,
        ...(r.tags || []),
      ]
        .join(' ')
        .toLocaleLowerCase()
        .includes(query.trim().toLocaleLowerCase()),
  )
  const sorted =
    sort === 'recent'
      ? [...filtered].sort((a, b) =>
          (b.updated_at || '').localeCompare(a.updated_at || ''),
        )
      : prioritizeRequests(
          filtered,
          showRecurrence && sort === 'recurrence',
        )
  const groups = showRecurrence ? recurringProblems(sorted) : []
  if (sort === 'priority')
    groups.sort(
      (a, b) => b.priority - a.priority || b.rows.length - a.rows.length,
    )
  if (sort === 'recent')
    groups.sort((a, b) =>
      (
        b.rows
          .map((r) => r.updated_at || '')
          .sort()
          .at(-1) || ''
      ).localeCompare(
        a.rows
          .map((r) => r.updated_at || '')
          .sort()
          .at(-1) || '',
      ),
    )
  const groupedIds = new Set(
    groups.flatMap((g) => g.rows.map((r) => r.id)),
  )
  const singles = sorted.filter((r) => !groupedIds.has(r.id))
  function exportCsv() {
    const q = (v: unknown) => {
      let s = String(v ?? '')
      if (/^[\s]*[=+\-@]/.test(s)) s = "'" + s
      return '"' + s.replaceAll('"', '""') + '"'
    }
    const data = [
      [
        'Номер',
        'Тема',
        'Категория',
        'Подразделение',
        'Статус',
        'Срок',
        'Решение',
        'Демо',
      ],
      ...sorted.map((r) => [
        requestNumber(r),
        r.title,
        categories[r.category_id],
        r.department,
        statusNames[r.status],
        r.due_at,
        r.decision,
        r.is_demo ? 'Да' : 'Нет',
      ]),
    ]
      .map((r) => r.map(q).join(';'))
      .join('\r\n')
    const url = URL.createObjectURL(
      new Blob(['\uFEFF' + data], { type: 'text/csv;charset=utf-8' }),
    )
    const a = document.createElement('a')
    a.href = url
    a.download = 'IdeaRoute-' + today() + '.csv'
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  return (
    <section className="card">
      <div className="card-head">
        <div>
          <h2>Единый реестр обращений</h2>
          <p aria-live="polite">
            Найдено {filtered.length} из {rows.length}
          </p>
        </div>
        <div className="ir-flex">
          <button className="btn sm" onClick={exportCsv}>
            <Download />
            Экспорт CSV
          </button>
          <div
            className="registry-modes"
            role="group"
            aria-label="Вид реестра"
          >
            {[
              ...(showRecurrence
                ? [{ id: 'groups', label: 'Темы', icon: Layers }]
                : []),
              { id: 'table', label: 'Список', icon: List },
              { id: 'board', label: 'Доска', icon: Columns3 },
            ].map((item) => (
              <button
                key={item.id}
                className={
                  'btn sm ' + (mode === item.id ? 'selected' : '')
                }
                aria-pressed={mode === item.id}
                onClick={() => setMode(item.id)}
              >
                <item.icon />
                <span>{item.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
      {(tag || kind || period !== 'all') && (
        <div className="detail-block">
          <p>
            Выборка из аналитики:{' '}
            {kind === 'problem' ? 'проблемы' : 'все типы'}
            {tag && ` · тема «${tag}»`}
            {period !== 'all' && ` · за ${period} дней`}.
          </p>
          <Link className="btn sm" href={path + '?view=registry'}>
            Открыть весь реестр
          </Link>
        </div>
      )}
      <div className="filters">
        <label className="search-input">
          <Search />
          <input
            aria-label="Поиск обращений"
            placeholder="Номер, тема, описание или решение"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <select
          className="filter-select"
          aria-label="Фильтр по статусу"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="">Все статусы</option>
          <option value="open">Все активные</option>
          <option value="done">С решением</option>
          <option value="overdue">Просрочены</option>
          <option value="unassigned">Без ответственного</option>
          {statuses.map((s) => (
            <option key={s} value={s}>
              {statusNames[s]}
            </option>
          ))}
        </select>
        <select
          className="filter-select"
          aria-label="Фильтр по категории"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          <option value="">Все категории</option>
          {Object.entries(categories).map(([id, name]) => (
            <option key={id} value={id}>
              {name}
            </option>
          ))}
        </select>
        <select
          className="filter-select"
          aria-label="Фильтр по подразделению"
          value={department}
          onChange={(e) => setDepartment(e.target.value)}
        >
          <option value="">Все подразделения</option>
          {[...new Set(rows.map((r) => r.department).filter(Boolean))].map(
            (d) => (
              <option key={d}>{d}</option>
            ),
          )}
        </select>
        <select
          className="filter-select"
          aria-label="Фильтр по сроку"
          value={deadline}
          onChange={(e) => setDeadline(e.target.value)}
        >
          <option value="">Любой срок</option>
          <option value="overdue">Просрочено</option>
          <option value="today">Сегодня</option>
        </select>
        <select
          className="filter-select"
          aria-label="Порядок обращений"
          value={sort}
          onChange={(e) => setSort(e.target.value)}
        >
          {showRecurrence && (
            <option value="recurrence">Сначала повторяющиеся</option>
          )}
          <option value="priority">По приоритету</option>
          <option value="recent">Сначала обновлённые</option>
        </select>
        {(query || status || category || department || deadline) && (
          <button
            className="btn sm"
            onClick={() => {
              setQuery('')
              setStatus('')
              setCategory('')
              setDepartment('')
              setDeadline('')
            }}
          >
            Сбросить
          </button>
        )}
      </div>
      {mode === 'groups' && showRecurrence ? (
        <div className="registry-groups">
          <p className="stat-definition">
            Количество указано один раз у темы. Группы образованы общей
            категорией и тегом; это возможные повторы. Одна карточка может
            входить в несколько тем. Счётчики учитывают текущие фильтры.
          </p>
          {groups.map((group) => (
            <details
              className="registry-group"
              key={JSON.stringify([group.category, group.tag])}
            >
              <summary>
                <span className="group-topic">
                  <strong>{group.tag}</strong>
                  <small>{categories[group.category]}</small>
                </span>
                <span className="group-count">
                  <strong>{group.rows.length}</strong> обращений
                </span>
                <span className="group-outcomes">
                  С решением: {group.results} · просрочено: {group.overdue}
                </span>
              </summary>
              <CaseTable
                rows={group.rows}
                categories={categories}
                path={path}
              />
            </details>
          ))}
          {singles.length > 0 && (
            <section aria-label="Без повторяющейся темы">
              <h3 className="singles-heading">
                Без повторяющейся темы · {singles.length}
              </h3>
              <CaseTable
                rows={singles}
                categories={categories}
                path={path}
              />
            </section>
          )}
          {!sorted.length && (
            <CaseTable rows={[]} categories={categories} path={path} />
          )}
        </div>
      ) : mode === 'board' ? (
        <div className="board">
          {[...statuses].map((s) => (
            <section className="board-col" key={s}>
              <strong>
                {statusNames[s]} ·{' '}
                {filtered.filter((r) => r.status === s).length}
              </strong>
              {sorted
                .filter((r) => r.status === s)
                .map((r) => (
                  <Link
                    className="board-card"
                    key={r.id}
                    href={path + '?view=registry&id=' + r.id}
                  >
                    <small className="case-id">{requestNumber(r)}</small>
                    <h3>{r.title}</h3>
                    <DueLabel row={r} />
                    {r.is_demo && <span className="tiny-pill">Демо</span>}
                  </Link>
                ))}
            </section>
          ))}
        </div>
      ) : (
        <CaseTable rows={sorted} categories={categories} path={path} />
      )}
      <footer className="table-foot">
        Показано {filtered.length} из {rows.length}
        <span>Доступ определяется вашей ролью</span>
      </footer>
    </section>
  )
}

export function RequestRegistry(
  props: Parameters<typeof RegistryFilters>[0],
) {
  const params = useSearchParams()
  return <RegistryFilters key={params.toString()} {...props} />
}
