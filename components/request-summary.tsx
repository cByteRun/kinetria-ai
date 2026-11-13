'use client'
import { useTranslations } from 'next-intl'

import { useState, useTransition } from 'react'
import dynamic from 'next/dynamic'
import { Sparkles } from 'lucide-react'
import { summarizeRequest } from '../app/workspace/actions'

const AiMarkdown = dynamic(() => import('./ai-markdown').then(module => module.AiMarkdown), {
  loading: () => <div className="ai-markdown" aria-busy="true">…</div>,
})

export function RequestSummary({ id }: { id: string }) {
  const ui = useTranslations('ui')

  const [result, setResult] = useState<{ text?: string; error?: string }>({})
  const [pending, start] = useTransition()
  return (
    <section className="crm-routing-preview" aria-busy={pending} aria-live="polite">
      <button
        className="button button-outline"
        disabled={pending}
        onClick={() =>
          start(async () => {
            try {
              setResult(await summarizeRequest(id))
            } catch {
              setResult({ error: ui('unableToPrepareTheSummary') })
            }
          })
        }
      >
        <Sparkles size={15} />
        {pending ? ui('preparingSummary') : ui('prepareAiSummary')}
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
