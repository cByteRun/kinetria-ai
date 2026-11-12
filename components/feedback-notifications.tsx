'use client'

import Link from 'next/link'
import { useState, useTransition } from 'react'
import { ArrowUpRight, Bell, CheckCheck, CircleCheck, MessageCircle, Clock3 } from 'lucide-react'
import { markSeen } from '../app/workspace/actions'
import { dateLabel, hasResult, isDone, isOverdue } from '../lib/dashboard'
import { requestNumber, StatusBadge, type RegistryRow } from './request-registry'
import { Heading } from './workspace-heading'

function feedback(row: RegistryRow, author: boolean) {
  if (hasResult(row)) return {
    title: row.acknowledged_at ? 'Автор ознакомился с решением' : 'Результат готов',
    action: author && !row.acknowledged_at ? 'Прочитать решение' : 'Открыть результат',
    hint: author && !row.acknowledged_at ? 'Ознакомьтесь с решением и подтвердите это в карточке.' : 'Решение и выполненные действия сохранены в карточке.',
    icon: CircleCheck, kind: 'result',
  }
  if (row.status === 'clarification') return {
    title: author ? 'Нужен ваш ответ' : 'Ожидается уточнение автора',
    action: author ? 'Ответить на уточнение' : 'Посмотреть запрос',
    hint: author ? 'Ответьте в карточке, чтобы рассмотрение продолжилось.' : 'Следующий шаг — ответ автора на запрос уточнения.',
    icon: MessageCircle, kind: author ? 'action' : 'update',
  }
  if (!isDone(row) && !row.assignee_id) return {
    title: 'Ожидается назначение ответственного',
    action: author ? 'Посмотреть маршрут' : 'Открыть обращение',
    hint: author ? 'Обращение сохранено. Администратор назначит ответственного из резервной очереди.' : 'Обращение в резервной очереди. Администратору нужно назначить руководителя.',
    icon: Clock3, kind: author ? 'update' : 'action',
  }
  return {
    title: isOverdue(row) ? 'Срок рассмотрения прошёл' : row.status === 'new' ? 'Обращение зарегистрировано' : 'Есть обновление по обращению',
    action: 'Посмотреть следующий шаг',
    hint: row.next_step || (author ? 'Ответственный продолжает рассмотрение. Статус и история доступны в карточке.' : 'Проверьте статус и зафиксируйте следующий шаг в карточке.'),
    icon: Bell, kind: !author && !isDone(row) ? 'action' : 'update',
  }
}

export function FeedbackNotifications({ rows, receipts, path }: {
  rows: RegistryRow[]; receipts: Record<string, number>; path: string
}) {
  const [filter, setFilter] = useState('unread')
  const [pending, start] = useTransition()
  const [error, setError] = useState('')
  const author = path.endsWith('/employee')
  const unread = (row: RegistryRow) => (receipts[row.id] || 0) < (row.version || 1)
  const unreadRows = rows.filter(unread)
  const items = [...rows].sort((a, b) => Number(unread(b)) - Number(unread(a)) ||
    (Date.parse(b.updated_at || '') || 0) - (Date.parse(a.updated_at || '') || 0))
    .filter(row => filter === 'all' || (filter === 'unread' ? unread(row) : feedback(row, author).kind === filter))
  function read(selected: RegistryRow[]) {
    setError('')
    start(async () => {
      try {
        const result = await markSeen(selected.map(row => ({ id: row.id, version: row.version || 1 })))
        setError(result.error || '')
      } catch { setError('Не удалось сохранить прочтение. Попробуйте ещё раз.') }
    })
  }
  return <>
    <Heading title="Уведомления" description="Что изменилось, кому действовать и где посмотреть результат." />
    <section className="card feedback-feed">
      <div className="card-head">
        <div><h2>{unreadRows.length ? `${unreadRows.length} непрочитанных обновлений` : 'Вы в курсе обновлений'}</h2>
          <p>Прочтение уведомления не подтверждает ознакомление с решением.</p></div>
        <button className="btn sm" disabled={pending || !unreadRows.length} onClick={() => read(unreadRows)}>
          <CheckCheck />{pending ? 'Сохраняем…' : 'Прочитать все'}
        </button>
      </div>
      <div className="feedback-filters" role="group" aria-label="Фильтр уведомлений">
        {[
          ['unread', 'Непрочитанные', unreadRows.length],
          ['action', 'Нужно действие', rows.filter(r => feedback(r, author).kind === 'action').length],
          ['result', 'Результаты', rows.filter(hasResult).length],
          ['all', 'Все', rows.length],
        ].map(([value, label, count]) => <button key={value} className={'btn sm ' + (filter === value ? 'selected' : '')}
          aria-pressed={filter === value} onClick={() => setFilter(String(value))}>{label} <span>{count}</span></button>)}
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div aria-live="polite" className="feedback-list">
        {items.map(row => {
          const item = feedback(row, author), Icon = item.icon
          return <article key={row.id} className={'notification feedback-notification ' + (unread(row) ? 'unread' : '')}>
            <span className={'feedback-icon ' + item.kind}><Icon aria-hidden="true" /></span>
            <div className="feedback-body">
              <div className="feedback-event"><h3>{item.title}</h3><time dateTime={row.updated_at}>{dateLabel(row.updated_at)}</time></div>
              <Link className="feedback-title" href={path + '?view=registry&id=' + row.id}>{requestNumber(row)} · {row.title}</Link>
              <div className="feedback-status"><StatusBadge row={row} />{!isDone(row) && row.due_at && <span className={isOverdue(row) ? 'red' : ''}>Срок: {dateLabel(row.due_at)}</span>}</div>
              {hasResult(row) && <p className="feedback-decision">{row.decision}</p>}
              <p>{item.hint}</p>
              <div className="feedback-actions"><Link className="btn sm" href={path + '?view=registry&id=' + row.id}>{item.action}<ArrowUpRight /></Link>
                {unread(row) && <button className="btn ghost sm" disabled={pending} onClick={() => read([row])}>Отметить прочитанным</button>}</div>
            </div>
          </article>
        })}
        {!items.length && <div className="empty"><Bell /><h3>{filter === 'unread' ? 'Непрочитанных обновлений нет' : 'В этом разделе пока нет обновлений'}</h3><p>Обращения, сроки и история доступны в реестре.</p><Link className="btn" href={path + '?view=registry'}>Перейти к обращениям</Link></div>}
      </div>
    </section>
  </>
}
