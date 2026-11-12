'use client'
import { useLocale, useTranslations } from 'next-intl'
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
  const locale = useLocale()

  const ui = useTranslations('ui')

  const [period, setPeriod] = useState('all')
  const data = rows.filter(
    (r) =>
      period === 'all' ||
      (r.created_at &&
        Date.parse(r.created_at) >= Date.now() - Number(period) * 86400000),
  )
  const done = data
    .filter(hasResult)
    .sort(
      (a, b) =>
        Date.parse(b.resolved_at || b.updated_at || '') -
        Date.parse(a.resolved_at || a.updated_at || ''),
    )
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
          locale === 'kk' ? 'ru-RU' : locale,
          { maximumFractionDigits: 1 },
        ) + ui('d')
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
          title={ui('howRoutingWorks')}
          description={ui('fromAnEmployeeRequestToADecisionAnd')}
        />
        <section className="card help-section">
          <h2>{ui('everyRequestHasANextStep')}</h2>
          <ol>
            <li>{ui('theEmployeeSubmitsARequestManuallyOrWith')}</li>
            <li>{ui('theCategoryDeterminesTheOwnerAndDeadlineIf')}</li>
            <li>{ui('theManagerOrOwnerStartsTheReviewAsks')}</li>
            <li>{ui('theEmployeeSReplyReturnsTheRequestTo')}</li>
            <li>{ui('theFinalDecisionIsAvailableToTheAuthor')}</li>
          </ol>
        </section>
        <section className="card help-section ir-section-gap">
          <h2>{ui('dataAndAccess')}</h2>
          <p>
            {ui(
              'authenticationPermissionsRequestsHistoryCommentsDeadlinesAndAcknowledgements',
            )}
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
          title={ui('results')}
          description={ui('decisionsCompletedActionsAndFeedbackToAuthors')}
        />
        <section className="card">
          <div className="card-head">
            <div>
              <h2>{ui('requestsWithARecordedDecision')}</h2>
              <p>
                {ui('resultCount', { done: done.length, total: data.length })}
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
                  {requestNumber(r)} ·{' '}
                  {dateLabel(r.resolved_at, locale, ui('notSet'))}{' '}
                  {r.is_demo && ui('demo')}
                </small>
              </div>
              <h3>{r.title}</h3>
              <p className="result-decision">{r.decision}</p>
              {r.next_step && (
                <p>
                  {ui('actions')} {r.next_step}
                </p>
              )}
              <div className="ir-result-meta">
                <CheckCheck />
                {r.acknowledged_at
                  ? ui('acknowledgedByTheAuthor') +
                    dateLabel(r.acknowledged_at, locale, ui('notSet'))
                  : ui('decisionReadyTheAuthorHasNotAcknowledgedIt')}
                <span className="result-open">
                  {path.endsWith('/employee') && !r.acknowledged_at
                    ? ui('readAndAcknowledge')
                    : ui('openResult')}{' '}
                  <ArrowUpRight />
                </span>
              </div>
            </Link>
          ))}
          {!done.length && (
            <div className="empty">
              <CircleCheck />
              <h3>{ui('resultsAreStillAhead')}</h3>
              <p>{ui('requestsWithAFinalStatusAndAMeaningful')}</p>
            </div>
          )}
        </section>
      </>
    )
  return (
    <>
      <Heading
        title={ui('analytics')}
        description={ui('whatChangesThroughEmployeeFeedback')}
        action={
          <select
            className="filter-select"
            aria-label={ui('analyticsPeriod')}
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
          >
            <option value="all">{ui('allTime')}</option>
            <option value="7">{ui('last7Days')}</option>
            <option value="30">{ui('last30Days')}</option>
            <option value="90">{ui('last90Days')}</option>
          </select>
        }
      />
      <div className="ir-metric-grid">
        {[
          [
            ui('timeToReview'),
            avg('first_response_at'),
            ui('averageTimeFromSubmissionToTheStartOf'),
            Clock3,
          ],
          [
            ui('timeToResult'),
            avg('resolved_at'),
            ui('averageTimeFromSubmissionToAFinalStatus'),
            CircleCheck,
          ],
          [
            ui('feedbackLoopComplete'),
            data.length
              ? Math.round((done.length / data.length) * 100) + '%'
              : '—',
            ui('requestsWithADecisionForTheAuthor', { value0: done.length }),
            CheckCheck,
          ],
          [
            ui('overdue'),
            data.filter(isOverdue).length,
            ui('activeRequestsPastTheirDeadline'),
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
      <Link className="card recurrence-entry" href={path + '?view=insights'}>
        <div>
          <h2>{ui('recurringTopics')}</h2>
          <p>{ui('frequencyShareOfProblemsAndOutcomesByTopic')}</p>
        </div>
        <ArrowUpRight />
      </Link>
      <div className="settings-grid">
        <section className="card">
          <div className="card-head">
            <div>
              <h2>{ui('requestTopics')}</h2>
              <p>{ui('categoriesWithTheMostRequests')}</p>
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
                  <Link href={registryLink({ category: c.id })}>{c.name}</Link>
                  <div className="chart-track">
                    <span
                      style={{
                        width: (c.count / Math.max(1, data.length)) * 100 + '%',
                      }}
                    />
                  </div>
                  <strong>{c.count}</strong>
                </div>
              ))}
          </div>
          <p className="stat-definition">
            {ui('categoryFrequencyHelpsIdentifyATopicToInvestigate')}
          </p>
        </section>
        <section className="card">
          <div className="card-head">
            <div>
              <h2>{ui('reviewOutcomes')}</h2>
              <p>{ui('accessibleRequestsForTheSelectedPeriod')}</p>
            </div>
          </div>
          <div className="detail-block">
            {[
              ['implemented', ui('implemented')],
              ['rejected', ui('rejected')],
              ['closed', ui('closedWithAResponse')],
              ['open', ui('stillInProgress')],
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
                        width: (count / Math.max(1, data.length)) * 100 + '%',
                      }}
                    />
                  </div>
                  <strong>{count}</strong>
                </div>
              )
            })}
          </div>
          <p className="stat-definition">
            <Info size={13} /> {ui('movingARequestIntoProgressDoesNotComplete')}
          </p>
        </section>
      </div>
    </>
  )
}
export { Heading } from './workspace-heading'
