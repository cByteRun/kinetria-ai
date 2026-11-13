'use client'
import { useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { analyzeRecurringTopics } from '../app/workspace/actions'
import type { SemanticTopic } from '../lib/semantic-topics'

export function SemanticTopics({ onSelect }: { onSelect: (ids: string[] | null) => void }) {
  const ui = useTranslations('ui')
  const [days, setDays] = useState(30)
  const [topics, setTopics] = useState<SemanticTopic[] | null>(null)
  const [selected, setSelected] = useState<number | null>(null)
  const [error, setError] = useState('')
  const [pending, start] = useTransition()
  return <section className="semantic-topics" aria-busy={pending}>
    <header><h3>{ui('semanticTopics')}</h3>
      <select aria-label={ui('topicPeriod')} disabled={pending} value={days} onChange={event => {
        setDays(Number(event.target.value)); setTopics(null); setSelected(null); setError(''); onSelect(null)
      }}>{[7, 30, 90].map(value => <option value={value} key={value}>{ui('topicDays', { days: value })}</option>)}</select>
      <button className="btn sm" disabled={pending} onClick={() => start(async () => {
        setError('')
        try {
          const result = await analyzeRecurringTopics(days)
          if ('error' in result) setError(result.error || ui('aiConnectionError'))
          else { setTopics(result.topics); setSelected(null); onSelect(null) }
        } catch { setError(ui('aiConnectionError')) }
      })}>{pending ? ui('preparingSummary') : ui('analyzeTopics')}</button>
      {selected !== null && <button className="btn sm" onClick={() => { setSelected(null); onSelect(null) }}>{ui('clearTopic')}</button>}
    </header>
    <small>{ui('topicExplanation')}</small>
    {error && <p role="alert">{error}</p>}
    <div className="semantic-topic-list" aria-live="polite">{topics?.map((topic, index) => <button className="btn" key={index} aria-pressed={selected === index} onClick={() => { setSelected(index); onSelect(topic.ids) }}>
      {topic.title} · {topic.current} · {topic.current > topic.previous ? '↑' : topic.current < topic.previous ? '↓' : '→'} {ui('topicComparison', { current: topic.current, previous: topic.previous })}
    </button>)}</div>
    {topics?.length === 0 && <p>{ui('noSemanticTopics')}</p>}
  </section>
}
