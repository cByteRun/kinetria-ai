'use client'
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
  const summary = recurrenceSummary(rows)
  const link = (params: Record<string, string>) =>
    path +
    '?' +
    new URLSearchParams({ view: 'registry', period, ...params })
  const percent = summary.problems
    ? Math.round((summary.recurring / summary.problems) * 100)
    : 0
  return (
    <>
      <Heading
        title="Повторяющиеся темы"
        description="Какие проблемы возвращаются и где уже есть решение. Только в вашей области доступа."
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
            'Повторяющиеся темы',
            summary.groups.length,
            'Категория и общий тематический тег',
          ],
          [
            'Обращений в темах',
            summary.recurring,
            'Каждая карточка учитывается один раз',
          ],
          [
            'С решением',
            summary.results,
            'Из обращений в повторяющихся темах',
          ],
          [
            'Просрочено',
            summary.overdue,
            'Активные обращения в этих темах',
          ],
        ].map(([label, value, note]) => (
          <section className="card metric" key={label}>
            <h2 className="metric-label">{label}</h2>
            <div className="metric-value">{value}</div>
            <p className="metric-note">{note}</p>
          </section>
        ))}
      </div>
      <div className="settings-grid ir-section-gap">
        <section className="card" aria-label="Доля повторяющихся проблем">
          <div className="card-head">
            <div>
              <h2>Доля повторяющихся проблем</h2>
              <p>От всех проблем выбранного периода</p>
            </div>
          </div>
          <div className="recurrence-share">
            <div
              className={
                'recurrence-donut' +
                (!summary.problems ? ' empty-donut' : '')
              }
              style={{
                background: `conic-gradient(var(--brand) ${percent}%, var(--line) 0)`,
              }}
              role="img"
              aria-label={`${summary.recurring} из ${summary.problems} проблем входят в повторяющиеся темы, ${percent}%`}
            >
              <div>
                <strong>{summary.problems ? percent + '%' : '—'}</strong>
                <span>повторяются</span>
              </div>
            </div>
            <ul className="chart-legend">
              <li>
                <span className="legend-dot" />В повторяющихся темах{' '}
                <strong>{summary.recurring}</strong>
              </li>
              <li>
                <span className="legend-dot single" />
                Без повторов <strong>{summary.single}</strong>
              </li>
            </ul>
          </div>
          <p className="stat-definition">
            Пожелания и отзывы исключены. Несколько тегов одной карточки не
            увеличивают эту долю.
          </p>
        </section>
        <section
          className="card"
          aria-label="Результаты повторяющихся проблем"
        >
          <div className="card-head">
            <div>
              <h2>Решения по повторяющимся проблемам</h2>
              <p>Уникальные обращения в темах</p>
            </div>
          </div>
          <div className="detail-block">
            {[
              [summary.results, 'С решением'],
              [summary.open, 'Без решения'],
            ].map(([count, label]) => (
              <div className="chart-bar" key={label}>
                <span>{label}</span>
                <div className="chart-track">
                  <span
                    style={{
                      width:
                        (Number(count) / Math.max(1, summary.recurring)) *
                          100 +
                        '%',
                    }}
                  />
                </div>
                <strong>{count}</strong>
              </div>
            ))}
          </div>
          <p className="stat-definition">
            Результат — итоговый статус и непустое решение. Ознакомление
            автора учитывается отдельно.
          </p>
        </section>
      </div>
      <section
        className="card ir-section-gap"
        aria-label="Повторяющиеся проблемы"
      >
        <div className="card-head">
          <div>
            <h2>Темы по частоте обращений</h2>
            <p>
              Сначала больше обращений, при равенстве — выше заданный
              приоритет.
            </p>
          </div>
          <Link className="btn sm" href={link({ mode: 'groups' })}>
            Открыть группы в реестре
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
                {group.rows.length} обращений · с решением: {group.results}{' '}
                · просрочено: {group.overdue}
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
              <h3>Повторяющихся тем пока нет</h3>
              <p>
                Для группы нужны две проблемы с общей категорией и
                тематическим тегом.
              </p>
            </div>
          )}
        </div>
        <p className="stat-definition">
          Одна проблема может входить в несколько тем: бары показывают
          частоты тем, их нельзя складывать. Совпадение тега — сигнал для
          проверки, а не подтверждённый дубликат. Карточки и их решения
          сохраняются отдельно.
        </p>
      </section>
    </>
  )
}
