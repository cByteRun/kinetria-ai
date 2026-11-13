'use client'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { recurrenceSummary } from '../lib/insights'
import { Heading } from './workspace-heading'
import { type RegistryRow, requestNumber } from './request-registry'
import { useState } from 'react'
import { SemanticTopics } from './semantic-topics'
import type { SavedTopic } from '../lib/topics'
import { hasResult, isOverdue } from '../lib/dashboard'

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
  const t = useTranslations('topicWorkbench')
  const [topics, setTopics] = useState<SavedTopic[]>([])
  const [selectedIds, setSelectedIds] = useState<string[] | null>(null)
  const selectedRows = selectedIds ? rows.filter(row => selectedIds.includes(row.id)) : rows

  const summary = recurrenceSummary(selectedRows)
  const link = (params: Record<string, string>) =>
    path + '?' + new URLSearchParams({ view: 'registry', period, ...params })
  const percent = summary.problems
    ? Math.round((summary.recurring / summary.problems) * 100)
    : 0
  return (
    <div className="recurring-screen"><SemanticTopics rows={rows} onSelect={setSelectedIds} onTopicsChange={setTopics}>
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
      <section className="card ir-section-gap" aria-label={t('monitoring')}>
        <div className="card-head"><div><h2>{t('monitoring')}</h2><p>{t('monitoringHint')}</p></div></div>
        <div className="detail-block">
          {topics.filter(topic => topic.ticketIds.some(id => selectedRows.some(row => row.id === id))).map(topic => {
            const members = selectedRows.filter(row => topic.ticketIds.includes(row.id))
            return <article className="recurrence-topic result-item" key={topic.id}>
              <h3>{topic.isAiGenerated && <span className="topic-ai">✨ AI</span>} {topic.title}</h3>
              <p>{t('monitoringCounts', {count: members.length, results: members.filter(hasResult).length, overdue: members.filter(isOverdue).length})}</p>
              {members.map(row => <p key={row.id}><Link href={path + '?view=registry&id=' + row.id}>{requestNumber(row)} · {row.title}</Link></p>)}
            </article>
          })}
          {!topics.some(topic => topic.ticketIds.some(id => selectedRows.some(row => row.id === id))) && <p>{t('monitoringEmpty')}</p>}
        </div>
      </section>
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
        <div className="table-scroll topic-frequency-table">
          <table className="case-table">
            <thead><tr><th>{ui('topics')}</th><th>{ui('requests')}</th><th>{ui('shareOfRecurringProblems')}</th><th>{ui('withADecision')}</th><th>{ui('overdue')}</th><th><span className="sr-only">{ui('openGroupsInRegistry')}</span></th></tr></thead>
            <tbody>{summary.groups.map(group => {
              const share = Math.round(group.rows.length / Math.max(1, summary.problems) * 100)
              return <tr key={JSON.stringify([group.category, group.tag])}>
                <td><strong>{group.tag}</strong><small>{categories[group.category]}</small></td>
                <td className="numeric">{group.rows.length}</td>
                <td><div className="topic-share-cell"><progress max={100} value={share} aria-label={group.tag}/><span className="numeric">{share}%</span></div></td>
                <td className="numeric">{group.results}</td><td className="numeric">{group.overdue}</td>
                <td><Link className="btn sm" href={link({category:group.category,tag:group.tag,kind:'problem',mode:'groups'})}>{ui('openGroupsInRegistry')}</Link></td>
              </tr>
            })}</tbody>
          </table>
          {!summary.groups.length && <div className="empty"><h3>{ui('noRecurringTopicsYet2')}</h3><p>{ui('aGroupNeedsTwoProblemsWithTheSame')}</p></div>}
        </div>
        <p className="stat-definition">
          {ui('oneProblemCanBelongToMultipleTopicsBars')}
        </p>
      </section>
    </SemanticTopics></div>
  )
}
