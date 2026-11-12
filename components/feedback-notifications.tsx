'use client'
import { useLocale, useTranslations } from 'next-intl'

import Link from 'next/link'
import { useState, useTransition } from 'react'
import {
  ArrowUpRight,
  Bell,
  CheckCheck,
  CircleCheck,
  MessageCircle,
  Clock3,
} from 'lucide-react'
import { markSeen } from '../app/workspace/actions'
import { dateLabel, hasResult, isDone, isOverdue } from '../lib/dashboard'
import {
  requestNumber,
  StatusBadge,
  type RegistryRow,
} from './request-registry'
import { Heading } from './workspace-heading'

function feedback(
  row: RegistryRow,
  author: boolean,
  ui: ReturnType<typeof useTranslations>,
) {
  if (hasResult(row))
    return {
      title: row.acknowledged_at
        ? ui('theAuthorAcknowledgedTheDecision')
        : ui('resultReady'),
      action:
        author && !row.acknowledged_at ? ui('readDecision') : ui('openResult'),
      hint:
        author && !row.acknowledged_at
          ? ui('readTheDecisionAndAcknowledgeItInThe')
          : ui('theDecisionAndCompletedActionsAreSavedIn'),
      icon: CircleCheck,
      kind: 'result',
    }
  if (row.status === 'clarification')
    return {
      title: author
        ? ui('yourReplyIsNeeded')
        : ui('waitingForTheAuthorSClarification'),
      action: author ? ui('replyToClarification') : ui('viewQuestion'),
      hint: author
        ? ui('replyInTheRequestCardSoTheReview')
        : ui('nextStepTheAuthorRepliesToTheClarification'),
      icon: MessageCircle,
      kind: author ? 'action' : 'update',
    }
  if (!isDone(row) && !row.assignee_id)
    return {
      title: ui('waitingForAnOwnerToBeAssigned'),
      action: author ? ui('viewRoute') : ui('openRequest'),
      hint: author
        ? ui('theRequestIsSavedTheAdministratorWillAssign')
        : ui('theRequestIsInTheFallbackQueueThe'),
      icon: Clock3,
      kind: author ? 'update' : 'action',
    }
  return {
    title: isOverdue(row)
      ? ui('theReviewDeadlineHasPassed')
      : row.status === 'new'
        ? ui('requestSubmitted')
        : ui('thereIsAnUpdateToTheRequest'),
    action: ui('viewNextStep'),
    hint:
      row.next_step ||
      (author
        ? ui('theOwnerIsReviewingTheRequestItsStatus')
        : ui('checkTheStatusAndRecordTheNextStep')),
    icon: Bell,
    kind: !author && !isDone(row) ? 'action' : 'update',
  }
}

export function FeedbackNotifications({
  rows,
  receipts,
  path,
}: {
  rows: RegistryRow[]
  receipts: Record<string, number>
  path: string
}) {
  const locale = useLocale()

  const ui = useTranslations('ui')

  const [filter, setFilter] = useState('unread')
  const [pending, start] = useTransition()
  const [error, setError] = useState('')
  const author = path.endsWith('/employee')
  const unread = (row: RegistryRow) =>
    (receipts[row.id] || 0) < (row.version || 1)
  const unreadRows = rows.filter(unread)
  const items = [...rows]
    .sort(
      (a, b) =>
        Number(unread(b)) - Number(unread(a)) ||
        (Date.parse(b.updated_at || '') || 0) -
          (Date.parse(a.updated_at || '') || 0),
    )
    .filter(
      (row) =>
        filter === 'all' ||
        (filter === 'unread'
          ? unread(row)
          : feedback(row, author, ui).kind === filter),
    )
  function read(selected: RegistryRow[]) {
    setError('')
    start(async () => {
      try {
        const result = await markSeen(
          selected.map((row) => ({ id: row.id, version: row.version || 1 })),
        )
        setError(result.error || '')
      } catch {
        setError(ui('unableToMarkAsReadTryAgain'))
      }
    })
  }
  return (
    <>
      <Heading
        title={ui('notifications')}
        description={ui('whatChangedWhoNeedsToActAndWhere')}
      />
      <section className="card feedback-feed">
        <div className="card-head">
          <div>
            <h2>
              {unreadRows.length
                ? ui('countUnread', { count: unreadRows.length })
                : ui('youAreUpToDate')}
            </h2>
            <p>{ui('readingANotificationDoesNotAcknowledgeTheDecision')}</p>
          </div>
          <button
            className="btn sm"
            disabled={pending || !unreadRows.length}
            onClick={() => read(unreadRows)}
          >
            <CheckCheck />
            {pending ? ui('saving') : ui('markAllAsRead')}
          </button>
        </div>
        <div
          className="feedback-filters"
          role="group"
          aria-label={ui('notificationFilter')}
        >
          {[
            ['unread', ui('unread'), unreadRows.length],
            [
              'action',
              ui('actionNeeded'),
              rows.filter((r) => feedback(r, author, ui).kind === 'action')
                .length,
            ],
            ['result', ui('results'), rows.filter(hasResult).length],
            ['all', ui('all'), rows.length],
          ].map(([value, label, count]) => (
            <button
              key={value}
              className={'btn sm ' + (filter === value ? 'selected' : '')}
              aria-pressed={filter === value}
              onClick={() => setFilter(String(value))}
            >
              {label} <span>{count}</span>
            </button>
          ))}
        </div>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div aria-live="polite" className="feedback-list">
          {items.map((row) => {
            const item = feedback(row, author, ui),
              Icon = item.icon
            return (
              <article
                key={row.id}
                className={
                  'notification feedback-notification ' +
                  (unread(row) ? 'unread' : '')
                }
              >
                <span className={'feedback-icon ' + item.kind}>
                  <Icon aria-hidden="true" />
                </span>
                <div className="feedback-body">
                  <div className="feedback-event">
                    <h3>{item.title}</h3>
                    <time dateTime={row.updated_at}>
                      {dateLabel(row.updated_at, locale, ui('notSet'))}
                    </time>
                  </div>
                  <Link
                    className="feedback-title"
                    href={path + '?view=registry&id=' + row.id}
                  >
                    {requestNumber(row)} · {row.title}
                  </Link>
                  <div className="feedback-status">
                    <StatusBadge row={row} />
                    {!isDone(row) && row.due_at && (
                      <span className={isOverdue(row) ? 'red' : ''}>
                        {ui('due')}{' '}
                        {dateLabel(row.due_at, locale, ui('notSet'))}
                      </span>
                    )}
                  </div>
                  {hasResult(row) && (
                    <p className="feedback-decision">{row.decision}</p>
                  )}
                  <p>{item.hint}</p>
                  <div className="feedback-actions">
                    <Link
                      className="btn sm"
                      href={path + '?view=registry&id=' + row.id}
                    >
                      {item.action}
                      <ArrowUpRight />
                    </Link>
                    {unread(row) && (
                      <button
                        className="btn ghost sm"
                        disabled={pending}
                        onClick={() => read([row])}
                      >
                        {ui('markAsRead')}
                      </button>
                    )}
                  </div>
                </div>
              </article>
            )
          })}
          {!items.length && (
            <div className="empty">
              <Bell />
              <h3>
                {filter === 'unread'
                  ? ui('noUnreadUpdates')
                  : ui('noUpdatesInThisSectionYet')}
              </h3>
              <p>{ui('requestsDeadlinesAndHistoryAreAvailableInThe')}</p>
              <Link className="btn" href={path + '?view=registry'}>
                {ui('goToRequests')}
              </Link>
            </div>
          )}
        </div>
      </section>
    </>
  )
}
