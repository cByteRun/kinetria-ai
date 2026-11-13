'use client'

import { QvinPanel } from './qvin-panel'
import { SemanticTopics } from './semantic-topics'
import { useLocale, useTranslations } from 'next-intl'
import Link from 'next/link'
import { memo, useDeferredValue, useMemo, useState, useEffect, useRef } from 'react'
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
  today,
} from '../lib/dashboard'

export type RegistryRow = {
  origin?: 'employee' | 'client'
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
  const statusText = useTranslations('requestsMvp')
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
      {statusText(row.status)}
    </span>
  )
}
export function DueLabel({ row }: { row: RegistryRow }) {
  const locale = useLocale()

  const ui = useTranslations('ui')

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
        ? dateLabel(row.resolved_at, locale, ui('notSet'))
        : isOverdue(row)
          ? ui('countOverdue', {
              count: Math.max(
                1,
                Math.ceil(
                  (Date.parse(today()) - Date.parse(row.due_at!)) / 86400000,
                ),
              ),
            })
          : row.due_at?.slice(0, 10) === today()
            ? ui('today')
            : dateLabel(row.due_at, locale, ui('notSet'))}
    </span>
  )
}
export const CaseTable = memo(function CaseTable({
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
  const ui = useTranslations('ui')

  return (
    <div className="table-scroll">
      <table className="case-table">
        <thead>
          <tr>
            <th>{ui('request')}</th>
            <th>{ui('status')}</th>
            {!compact && (
              <>
                <th>{ui('department')}</th>
                <th>{ui('priority')}</th>
              </>
            )}
            <th>{ui('dueDate')}</th>
            <th aria-label={ui('open')} />
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td data-label={ui('request')}>
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
                        <span className="tiny-pill">{ui('demo2')}</span>
                      )}
                    </div>
                  </div>
                </div>
              </td>
              <td data-label={ui('status')}>
                <StatusBadge row={row} />
                {row.status === 'clarification' && (
                  <div className="case-caption">
                    {ui('waitingForTheAuthorSReply')}
                  </div>
                )}
                {!row.assignee_id && !isDone(row) && (
                  <div className="case-caption">{ui('fallbackQueue')}</div>
                )}
              </td>
              {!compact && (
                <>
                  <td data-label={ui('department')}>{row.department || '—'}</td>
                  <td data-label={ui('priority')}>
                    <span
                      className={row.priority === 'high' ? 'amber' : 'muted'}
                    >
                      {row.priority === 'high'
                        ? ui('high')
                        : row.priority === 'low'
                          ? ui('low')
                          : ui('normal')}
                    </span>
                  </td>
                </>
              )}
              <td data-label={ui('dueDate')}>
                <DueLabel row={row} />
              </td>
              <td className="case-open">
                <Link
                  className="icon-button"
                  href={path + '?view=registry&id=' + row.id}
                  aria-label={ui('open2') + requestNumber(row)}
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
          <h3>{ui('noRequestsYet')}</h3>
          <p>{ui('changeTheFiltersOrSubmitANewRequest')}</p>
        </div>
      )}
    </div>
  )
})

function RegistryFilters({
  rows,
  categories,
  path,
  showRecurrence = false,
  canAskQvin = false,
}: {
  canAskQvin?: boolean
  showRecurrence?: boolean
  rows: RegistryRow[]
  categories: Record<string, string>
  path: string
}) {
  const ui = useTranslations('ui')

  const statusText = useTranslations('requestsMvp')
  const params = useSearchParams()
  const [query, setQuery] = useState(params.get('q') || ''),
    [status, setStatus] = useState(params.get('filter') || ''),
    [category, setCategory] = useState(params.get('category') || ''),
    [department, setDepartment] = useState(''),
    [deadline, setDeadline] = useState(''),
    [mode, setMode] = useState(
      params.get('mode') === 'board' ? 'board' : showRecurrence ? params.get('mode') || 'table' : 'table',
    ),
    [sort, setSort] = useState('newest')
  const expansion = useTranslations('productExpansion')
  const [origin, setOrigin] = useState('')
  const [topicIds, setTopicIds] = useState<string[] | null>(null)
  const topicSet = useMemo(() => topicIds ? new Set(topicIds) : null, [topicIds])
  const tag = params.get('tag') || ''
  const kind = params.get('kind') || ''
  const period = params.get('period') || 'all'
  const deferredQuery = useDeferredValue(query)
  const normalizedQuery = deferredQuery.trim().toLocaleLowerCase()
  const day = today()
  const normalizedTag = normalizeTopic(tag)
  const filtered = useMemo(() => rows.filter(
    (r) =>
      (!origin || (r.origin || 'employee') === origin) &&
      (!tag ||
        (r.tags || []).some(
          (t) => normalizeTopic(t) === normalizedTag,
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
        .includes(normalizedQuery),
  ), [rows, origin, categories, tag, normalizedTag, kind, period, status, category, department, deadline, normalizedQuery, day])
  const topicFiltered = useMemo(() => filtered.filter(row => !topicSet || topicSet.has(row.id)), [filtered, topicSet])
  const sorted = useMemo(() =>
    sort === 'newest'
      ? [...topicFiltered].sort((a, b) =>
          (b.created_at || '').localeCompare(a.created_at || '') || b.number - a.number,
        )
      : sort === 'recent'
        ? [...topicFiltered].sort((a, b) =>
            (b.updated_at || '').localeCompare(a.updated_at || ''),
          )
        : prioritizeRequests(topicFiltered, showRecurrence && sort === 'recurrence'),
    [topicFiltered, sort, showRecurrence])
  const groups = useMemo(() => {
    const groups = showRecurrence && mode === 'groups' ? recurringProblems(sorted) : []
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
    return groups
  }, [sorted, showRecurrence, mode, sort])
  const singles = useMemo(() => {
    const groupedIds = new Set(groups.flatMap(g => g.rows.map(r => r.id)))
    return sorted.filter(r => !groupedIds.has(r.id))
  }, [groups, sorted])
  const departments = useMemo(() => [...new Set(rows.map(r => r.department).filter(Boolean))], [rows])
  const boardColumns = useMemo(() => statuses.map(status => ({ status, rows: sorted.filter(row => row.status === status) })), [sorted])
  function exportCsv() {
    const q = (v: unknown) => {
      let s = String(v ?? '')
      if (/^[\s]*[=+\-@]/.test(s)) s = "'" + s
      return '"' + s.replaceAll('"', '""') + '"'
    }
    const data = [
      [
        ui('number'),
        ui('subject'),
        ui('category'),
        ui('department'),
        ui('status'),
        ui('dueDate'),
        ui('decision'),
        ui('demo2'),
      ],
      ...sorted.map((r) => [
        requestNumber(r),
        r.title,
        categories[r.category_id],
        r.department,
        statusText(r.status),
        r.due_at,
        r.decision,
        r.is_demo ? ui('yes') : ui('no'),
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
    <section className={"registry-card registry-" + mode}>
      <SemanticTopics enabled={showRecurrence} rows={filtered} onSelect={setTopicIds}>
      {canAskQvin && <QvinPanel key={sorted.map(r => r.id).join()} ids={sorted.map(r => r.id)} />}
      <div className="card-head registry-header">
        <div>
          <h1>{mode === 'board' ? ui('board') : ui('unifiedRequestRegistry')}</h1>
          <p aria-live="polite">
            {ui('foundCount', { shown: topicFiltered.length, total: rows.length })}
          </p>
        </div>
        <div className="ir-flex">
          <button className="btn sm" onClick={exportCsv}>
            <Download />
            {ui('exportCsv')}
          </button>
          <div
            className="registry-modes"
            role="group"
            aria-label={ui('registryView')}
          >
            {[
              ...(showRecurrence
                ? [{ id: 'groups', label: ui('topics'), icon: Layers }]
                : []),
              { id: 'table', label: ui('list'), icon: List },
              { id: 'board', label: ui('board'), icon: Columns3 },
            ].map((item) => (
              <button
                key={item.id}
                className={'btn sm ' + (mode === item.id ? 'selected' : '')}
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
            {ui('selectionFromAnalytics')}{' '}
            {kind === 'problem' ? ui('problems') : ui('allTypes')}
            {tag && ui('topic', { value0: tag })}
            {period !== 'all' && ui('lastDays', { value0: period })}.
          </p>
          <Link className="btn sm" href={path + '?view=registry'}>
            {ui('openFullRegistry')}
          </Link>
        </div>
      )}
      <div className="filters">
        <select className="filter-select" aria-label={expansion('origin')} value={origin} onChange={e=>setOrigin(e.target.value)}><option value="">{expansion('allOrigins')}</option><option value="employee">{expansion('employee')}</option><option value="client">{expansion('client')}</option></select>
        <label className="search-input">
          <Search />
          <input
            data-request-search
            aria-label={ui('searchRequests')}
            placeholder={ui('numberSubjectDescriptionOrDecision')}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <select
          className="filter-select"
          aria-label={ui('filterByStatus')}
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="">{ui('allStatuses')}</option>
          <option value="open">{ui('allActive')}</option>
          <option value="done">{ui('withADecision')}</option>
          <option value="overdue">{ui('overdue2')}</option>
          <option value="unassigned">{ui('noOwner')}</option>
          {statuses.map((s) => (
            <option key={s} value={s}>
              {statusText(s)}
            </option>
          ))}
        </select>
        <select
          className="filter-select"
          aria-label={ui('filterByCategory')}
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          <option value="">{ui('allCategories')}</option>
          {Object.entries(categories).map(([id, name]) => (
            <option key={id} value={id}>
              {name}
            </option>
          ))}
        </select>
        <select
          className="filter-select"
          aria-label={ui('filterByDepartment')}
          value={department}
          onChange={(e) => setDepartment(e.target.value)}
        >
          <option value="">{ui('allDepartments')}</option>
          {departments.map(
            (d) => (
              <option key={d}>{d}</option>
            ),
          )}
        </select>
        <select
          className="filter-select"
          aria-label={ui('filterByDeadline')}
          value={deadline}
          onChange={(e) => setDeadline(e.target.value)}
        >
          <option value="">{ui('anyDeadline')}</option>
          <option value="overdue">{ui('overdue')}</option>
          <option value="today">{ui('today')}</option>
        </select>
        <select
          className="filter-select"
          aria-label={ui('requestOrder')}
          value={sort}
          onChange={(e) => setSort(e.target.value)}
        >
          <option value="newest">{ui('newestFirst')}</option>
          {showRecurrence && (
            <option value="recurrence">{ui('recurringFirst')}</option>
          )}
          <option value="priority">{ui('byPriority')}</option>
          <option value="recent">{ui('recentlyUpdatedFirst')}</option>
        </select>
        {(query || status || category || department || deadline || origin) && (
          <button
            className="btn sm"
            onClick={() => {
              setOrigin('')
              setQuery('')
              setStatus('')
              setCategory('')
              setDepartment('')
              setDeadline('')
            }}
          >
            {ui('reset')}
          </button>
        )}
      </div>
      {mode === 'groups' && showRecurrence ? (
        <div className="registry-groups">
          <p className="stat-definition">
            {ui('theCountAppearsOncePerTopicGroupsShare')}
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
                  <strong>
                    {ui('countRequests', { count: group.rows.length })}
                  </strong>
                </span>
                <span className="group-outcomes">
                  {ui('groupOutcomes', {
                    results: group.results,
                    overdue: group.overdue,
                  })}
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
            <section aria-label={ui('withoutARecurringTopic')}>
              <h3 className="singles-heading">
                {ui('withoutARecurringTopic2')}
                {singles.length}
              </h3>
              <CaseTable rows={singles} categories={categories} path={path} />
            </section>
          )}
          {!sorted.length && (
            <CaseTable rows={[]} categories={categories} path={path} />
          )}
        </div>
      ) : mode === 'board' ? (
        <>
        <div className="board-status-filters" role="group" aria-label={ui('status')}>
          <button className="btn" aria-pressed={!status} onClick={() => setStatus('')}>{ui('all')}</button>
          {statuses.map(s => <button className="btn" key={s} aria-pressed={status === s} onClick={() => setStatus(s)}>{statusText(s)}</button>)}
        </div>
        <BoardViewport>
          {boardColumns.map(({ status: s, rows: columnRows }) => (
            <section className="board-col" key={s} data-empty={!columnRows.length}>
              <strong>
                {statusText(s)} ·{' '}
                {columnRows.length}
              </strong>
              {columnRows.map((r) => (
                  <Link
                    className="board-card"
                    key={r.id}
                    href={path + '?view=registry&mode=board&id=' + r.id}
                  >
                    <small className="case-id">{requestNumber(r)}</small>
                    <h3>{r.title}</h3>
                    <DueLabel row={r} />
                    {r.is_demo && (
                      <span className="tiny-pill">{ui('demo2')}</span>
                    )}
                  </Link>
                ))}
            </section>
          ))}
        </BoardViewport>
        </>
      ) : (
        <CaseTable rows={sorted} categories={categories} path={path} />
      )}
      <footer className="table-foot">
        {ui('showingCount', { shown: topicFiltered.length, total: rows.length })}
        <span>{ui('accessIsDeterminedByYourRole')}</span>
      </footer>
      </SemanticTopics>
    </section>
  )
}

function BoardViewport({children}: {children: React.ReactNode}) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const element = ref.current
    if (!element) return
    const resize = () => { element.style.height = window.innerWidth < 1024 ? 'auto' : Math.max(280, window.innerHeight - element.getBoundingClientRect().top - 24) + 'px' }
    const observer = new ResizeObserver(resize)
    if (element.parentElement) observer.observe(element.parentElement)
    window.addEventListener('resize', resize)
    resize()
    return () => { observer.disconnect(); window.removeEventListener('resize', resize) }
  }, [])
  return <div ref={ref} className="board">{children}</div>
}

export function RequestRegistry(props: Parameters<typeof RegistryFilters>[0]) {
  const params = useSearchParams()
  return <RegistryFilters key={params.toString()} {...props} />
}
