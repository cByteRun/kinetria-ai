'use client'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { recurrenceSummary } from '../lib/insights'
import { Heading } from './workspace-heading'
import { type RegistryRow, requestNumber } from './request-registry'
import { hasResult } from '../lib/dashboard'

export function RecurringAnalytics({
  rows,
  categories,
  path,
  period,
  setPeriod,
}: {
  rows: RegistryRow[]
  categories: Record<string, string>
  path: string
  period: string
  setPeriod: (value: string) => void
}) {
  const ui = useTranslations('ui')

  const summary = recurrenceSummary(rows)
  const link = (params: Record<string, string>) =>
    path + '?' + new URLSearchParams({ view: 'registry', period, ...params })
  const percent = summary.problems
    ? Math.round((summary.recurring / summary.problems) * 100)
    : 0
  return (
    <>
      <Heading
        title={ui('recurringTopics')}
        description={ui('whichProblemsRecurAndWhereASolutionAlready')}
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
            ui('recurringTopics'),
            summary.groups.length,
            ui('categoryAndSharedTopicTag'),
          ],
          [
            ui('requestsInTopics'),
            summary.recurring,
            ui('eachCardIsCountedOnce'),
          ],
          [
            ui('withADecision'),
            summary.results,
            ui('amongRequestsInRecurringTopics'),
          ],
          [ui('overdue'), summary.overdue, ui('activeRequestsInTheseTopics')],
        ].map(([label, value, note]) => (
          <section className="card metric" key={label}>
            <h2 className="metric-label">{label}</h2>
            <div className="metric-value">{value}</div>
            <p className="metric-note">{note}</p>
          </section>
        ))}
      </div>
      <div className="settings-grid ir-section-gap">
        <section className="card" aria-label={ui('shareOfRecurringProblems')}>
          <div className="card-head">
            <div>
              <h2>{ui('shareOfRecurringProblems')}</h2>
              <p>{ui('ofAllProblemsInTheSelectedPeriod')}</p>
            </div>
          </div>
          <div className="recurrence-share">
            <div
              className={
                'recurrence-donut' + (!summary.problems ? ' empty-donut' : '')
              }
              style={{
                background: `conic-gradient(var(--brand) ${percent}%, var(--line) 0)`,
              }}
              role="img"
              aria-label={ui('ofProblemsBelongToRecurringTopics', {
                value0: summary.recurring,
                value1: summary.problems,
                value2: percent,
              })}
            >
              <div>
                <strong>{summary.problems ? percent + '%' : '—'}</strong>
                <span>{ui('recurring')}</span>
              </div>
            </div>
            <ul className="chart-legend">
              <li>
                <span className="legend-dot" />
                {ui('inRecurringTopics')} <strong>{summary.recurring}</strong>
              </li>
              <li>
                <span className="legend-dot single" />
                {ui('withoutRecurrence')}
                <strong>{summary.single}</strong>
              </li>
            </ul>
          </div>
          <p className="stat-definition">
            {ui('suggestionsAndFeedbackAreExcludedMultipleTagsOn')}
          </p>
        </section>
        <section className="card" aria-label={ui('recurringProblemOutcomes')}>
          <div className="card-head">
            <div>
              <h2>{ui('decisionsOnRecurringProblems')}</h2>
              <p>{ui('uniqueRequestsInTopics')}</p>
            </div>
          </div>
          <div className="detail-block">
            {[
              [summary.results, ui('withADecision')],
              [summary.open, ui('withoutADecision')],
            ].map(([count, label]) => (
              <div className="chart-bar" key={label}>
                <span>{label}</span>
                <div className="chart-track">
                  <span
                    style={{
                      width:
                        (Number(count) / Math.max(1, summary.recurring)) * 100 +
                        '%',
                    }}
                  />
                </div>
                <strong>{count}</strong>
              </div>
            ))}
          </div>
          <p className="stat-definition">
            {ui('aResultRequiresAFinalStatusAndA')}
          </p>
        </section>
      </div>
      <section
        className="card ir-section-gap"
        aria-label={ui('recurringProblems')}
      >
        <div className="card-head">
          <div>
            <h2>{ui('topicsByRequestFrequency')}</h2>
            <p>{ui('moreRequestsFirstTiesAreOrderedByAssigned')}</p>
          </div>
          <Link className="btn sm" href={link({ mode: 'groups' })}>
            {ui('openGroupsInRegistry')}
          </Link>
        </div>
        <div className="detail-block">
          {summary.groups.map((group) => (
            <div
              className="recurrence-topic result-item"
              key={JSON.stringify([group.category, group.tag])}
            >
              <Link
                className="chart-bar"
                href={link({
                  category: group.category,
                  tag: group.tag,
                  kind: 'problem',
                  mode: 'groups',
                })}
              >
                <span>
                  <strong>{group.tag}</strong>
                  <small>{categories[group.category]}</small>
                </span>
                <span className="chart-track">
                  <span
                    style={{
                      width:
                        (group.rows.length /
                          Math.max(1, summary.groups[0].rows.length)) *
                          100 +
                        '%',
                    }}
                  />
                </span>
                <strong>{group.rows.length}</strong>
              </Link>
              <p>
                {group.rows.length} {ui('requestsWithADecision')}
                {group.results} {ui('overdue3')}
                {group.overdue}
              </p>
              {group.rows.filter(hasResult).map((r) => (
                <p key={r.id}>
                  <Link href={path + '?view=registry&id=' + r.id}>
                    {requestNumber(r)}: {r.decision}
                  </Link>
                </p>
              ))}
            </div>
          ))}
          {!summary.groups.length && (
            <div className="empty">
              <h3>{ui('noRecurringTopicsYet2')}</h3>
              <p>{ui('aGroupNeedsTwoProblemsWithTheSame')}</p>
            </div>
          )}
        </div>
        <p className="stat-definition">
          {ui('oneProblemCanBelongToMultipleTopicsBars')}
        </p>
      </section>
    </>
  )
}
