'use client'
import { useTranslations } from 'next-intl'

import { useState, useTransition } from 'react'
import { Sparkles } from 'lucide-react'
import { summarizeRequest } from '../app/workspace/actions'

export function RequestSummary({ id }: { id: string }) {
  const ui = useTranslations('ui')

  const [result, setResult] = useState<{ text?: string; error?: string }>({})
  const [pending, start] = useTransition()
  return (
    <section className="crm-routing-preview">
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
          <p className="request-text">{result.text}</p>
          <small>{ui('automaticSummaryBasedOnRequestDataCheckIt')}</small>
        </>
      )}
      {result.error && <p role="alert">{result.error}</p>}
    </section>
  )
}
