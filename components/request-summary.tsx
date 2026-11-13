'use client'
import { useTranslations } from 'next-intl'

import { useEffect, useState, useTransition } from 'react'
import dynamic from 'next/dynamic'
import { Sparkles } from 'lucide-react'
import { summarizeRequest } from '../app/workspace/actions'

const AiMarkdown = dynamic(() => import('./ai-markdown').then(module => module.AiMarkdown), {
  loading: () => <div className="ai-markdown" aria-busy="true">…</div>,
})

export function RequestSummary({ id }: { id: string }) {
  const ui = useTranslations('ui')

  const [result, setResult] = useState<{ text?: string; error?: string; retryAfterSeconds?: number }>({})
  const [remaining, setRemaining] = useState(0)
  const [pending, start] = useTransition()
  useEffect(() => {
    if (!remaining) return
    const timer = setTimeout(() => setRemaining(value => Math.max(0, value - 1)), 1000)
    return () => clearTimeout(timer)
  }, [remaining])
  return (
    <section className="crm-routing-preview" aria-busy={pending} aria-live="polite">
      <button
        className="button button-outline"
        disabled={pending || remaining > 0}
        onClick={() =>
          start(async () => {
            setResult({})
            try {
              const next = await summarizeRequest(id)
              setResult(next)
              setRemaining(next.retryAfterSeconds ?? 0)
            } catch {
              setResult({ error: ui('unableToPrepareTheSummary') })
              setRemaining(10)
            }
          })
        }
      >
        <Sparkles size={15} />
        {pending ? ui('preparingSummary') : remaining > 0 ? ui('aiSummaryRetryIn', { seconds: remaining }) : result.error ? ui('aiSummaryRetry') : ui('prepareAiSummary')}
      </button>
      {result.text && (
        <>
          <AiMarkdown text={result.text} />
          <small>{ui('automaticSummaryBasedOnRequestDataCheckIt')}</small>
        </>
      )}
      {result.error && <p role="alert">{result.error}</p>}
    </section>
  )
}
