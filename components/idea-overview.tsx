'use client'
import { useTranslations } from 'next-intl'
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
import { CaseTable, StatusBadge, type RegistryRow } from './request-registry'
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
  const ui = useTranslations('ui')
  const shell = useTranslations('dashboardShell')

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
    ['new', ui('received'), ui('categoryAndRoute')],
    ['review', ui('review'), ui('ownerAssigned')],
    ['clarification', ui('clarification'), ui('dialogueWithTheAuthor')],
    ['in_progress', ui('actions2'), ui('theDecisionIsBeingCarriedOut')],
    ['done', ui('result'), ui('responsePublished')],
  ]
  const recurring = canViewInsights(role)
    ? recurringProblems(rows)[0]
    : undefined
  const filter = (value: string) => path + '?view=registry&filter=' + value
  return (
    <>
      <section data-tour-overview={role} className="lifecycle-hero" aria-labelledby="lifecycle-title">
        <div className="page-heading">
          <div>
            <div className="eyebrow">
              {shell('heroEyebrow')}
            </div>
            <h1 id="lifecycle-title">
              {shell('heroTitle')}
            </h1>
            <p>
              {shell('heroDescription')}
            </p>
          </div>
          <Link
            data-tour="overview-create"
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
              ? ui('newRequest')
              : admin
                ? ui('configureRouting')
                : ui('reviewRequests')}{' '}
            <ArrowUpRight />
          </Link>
        </div>
        <div data-tour="overview-pulse" className="hero-summary">
          <Link href={filter('open')}><span className="hero-stat-icon"><Inbox size={18} /></span><span><strong>{active.length}</strong><small>{shell('activeRequests')}</small></span></Link>
          <Link href={filter('clarification')}><span className="hero-stat-icon"><ClockAlert size={18} /></span><span><strong>{rows.filter(r => r.status === 'clarification').length}</strong><small>{ui('clarification')}</small></span></Link>
          <Link href={path + '?view=results'} className="hero-progress">
            <span><small>{ui('withARecordedDecision')}</small><strong>{rows.length ? Math.round(done.length / rows.length * 100) + '%' : '—'}</strong></span>
            <progress value={done.length} max={Math.max(1, rows.length)} aria-label={ui('withARecordedDecision')} />
          </Link>
        </div>
      </section>
      <div className="context-line">
        <span className="ir-flex">
          <Building2 />
          {employee
            ? ui('myWorkRoute')
            : admin
              ? ui('allDepartments')
              : ui('myArea')}{' '}
          · {ui('countRequests', { count: rows.length })}
        </span>
        <span className="ir-flex">
          <CalendarDays />
          {ui('allTime')}
          {rows.some((r) => r.is_demo) && (
            <span className="tiny-pill">{ui('includesDemoData')}</span>
          )}
        </span>
      </div>
      <div data-tour="overview-metrics" className="ir-metric-grid">
        {[
          {
            label: ui('inProgressAndUnderReview'),
            value: active.length,
            note: ui('requestsAwaitingAnOutcome'),
            icon: Inbox,
            filter: 'open',
            tone: '',
          },
          {
            label: employee
              ? ui('yourReplyIsNeeded')
              : admin
                ? ui('noOwner')
                : ui('needsAttention'),
            value: attention.length,
            note: employee
              ? ui('theManagerRequestedClarification')
              : admin
                ? ui('inTheAdministratorSFallbackQueue')
                : ui('pastTheReviewDeadline', { value0: late.length }),
            icon: ClockAlert,
            filter: employee ? 'clarification' : admin ? 'unassigned' : 'open',
            tone: attention.length ? 'amber' : '',
          },
          {
            label: ui('withARecordedDecision'),
            value: rows.length
              ? Math.round((done.length / rows.length) * 100) + '%'
              : '—',
            note: ui('ofResultAvailableToTheAuthor', {
              value0: done.length,
              value1: rows.length,
            }),
            icon: CircleCheck,
            filter: 'done',
            tone: '',
          },
          {
            label: ui('improvementsImplemented'),
            value: implemented.length,
            note: ui('confirmedActionsAndOutcomes'),
            icon: Lightbulb,
            filter: 'implemented',
            tone: 'green',
          },
        ].map((m) => (
          <Link className="card metric" key={m.label} href={filter(m.filter)}>
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
        <section data-tour="overview-route" id="request-lifecycle" className="card route-card">
          <div className="card-head">
            <div>
              <h2>{ui('requestRoute')}</h2>
              <p>{ui('aClearNextStepAtEveryStage')}</p>
            </div>
            <span className="tiny-pill">{ui('fromIdeaToOutcome')}</span>
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
            {ui('theDecisionActionsAndResponseToTheAuthor')}
          </div>
        </section>
        <section data-tour="overview-results" className="card loop-card">
          <div>
            <div className="eyebrow">{ui('feedbackLoop')}</div>
            <h2>
              {ui('thereIsAResult')}
              <br />
              {ui('theAuthorCanSeeTheResponse')}
            </h2>
          </div>
          <div>
            <div className="ir-flex">
              <span className="loop-number mono">{done.length}</span>
              <span className="subtle">
                {ui('of')} {ui('countRequests', { count: rows.length })}
              </span>
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
              {ui('decisionRecorded')}
            </div>
            <div className="loop-check">
              <Check />
              {ui('responseAvailableInTheWorkspace')}
            </div>
            <Link className="btn ghost sm" href={path + '?view=results'}>
              {ui('viewResults')}
              <ArrowRight />
            </Link>
          </div>
        </section>
      </div>
      <div className="overview-bottom ir-bottom-grid">
        <section data-tour="overview-focus" data-tour-empty={queue.length === 0} className="card">
          <div className="card-head">
            <div>
              <h2>{employee ? ui('yourNextStep') : ui('inFocus')}</h2>
              <p>
                {employee
                  ? ui('clarificationsAndRequestsStillAwaitingAnOutcome')
                  : ui('startWithRequestsThatNeedYourAction')}
              </p>
            </div>
            <Link
              href={path + '?view=registry'}
              aria-label={ui('openFullRegistry')}
            >
              <ArrowUpRight />
            </Link>
          </div>
          <div className="tabs">
            {[
              [
                'attention',
                employee
                  ? ui('replyNeeded')
                  : admin
                    ? ui('unassigned')
                    : ui('needsAttention'),
                attention.length,
              ],
              ['overdue', ui('overdue2'), late.length],
              ['all', ui('allActive'), active.length],
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
                ? ui('showingCount', {
                    shown: Math.min(4, queue.length),
                    total: queue.length,
                  })
                : ui('allRequestsAreUnderControl')}
            </span>
            <Link className="brand" href={path + '?view=registry'}>
              {ui('goToRegistry')}
              <ArrowRight />
            </Link>
          </div>
        </section>
        <div className="overview-side ir-stack">
          <section className="card">
            <div className="card-head">
              <div>
                <h2>{ui('latestResults')}</h2>
                <p>{ui('whatChangedThroughFeedback')}</p>
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
                      ? ui('acknowledgedByAuthor')
                      : ui('responsePublishedForTheAuthor')}
                  </div>
                </Link>
              ))}
            {!done.length && (
              <div className="empty">
                <CircleCheck />
                <p>{ui('resultsWillAppearAfterRequestsAreReviewed')}</p>
              </div>
            )}
          </section>
          {canViewInsights(role) && (
            <section className="card repeat-card">
              <div className="ir-flex ir-between">
                <h3>{ui('recurringTopic')}</h3>
                <Layers className="brand" />
              </div>
              <p>{recurring ? recurring.tag : ui('noRecurringTopicsYet')}</p>
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
                    {recurring.rows.length} {ui('requestsInThisTopic')}
                  </span>
                  <ArrowUpRight />
                </Link>
              )}
              <p className="ir-disclaimer">
                {ui('aSharedCategoryAndTagSuggestATopic')}
              </p>
              <Link className="btn ghost sm" href={path + '?view=insights'}>
                {ui('recurrenceAnalytics')}
                <ArrowRight />
              </Link>
            </section>
          )}
        </div>
      </div>
    </>
  )
}
