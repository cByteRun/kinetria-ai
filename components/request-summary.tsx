'use client'

import { useState, useTransition } from 'react'
import { Sparkles } from 'lucide-react'
import { summarizeRequest } from '../app/workspace/actions'

export function RequestSummary({ id }: { id: string }) {
  const [result, setResult] = useState<{ text?: string; error?: string }>({})
  const [pending, start] = useTransition()
  return <section className="crm-routing-preview">
    <button className="button button-outline" disabled={pending} onClick={() => start(async () => {
      try { setResult(await summarizeRequest(id)) }
      catch { setResult({ error: 'Не удалось подготовить сводку.' }) }
    })}><Sparkles size={15} />{pending ? 'Подготовка сводки…' : 'Подготовить AI-сводку'}</button>
    {result.text && <><p className="request-text">{result.text}</p><small>Автоматическая сводка по данным обращения. Проверьте её перед принятием решения.</small></>}
    {result.error && <p role="alert">{result.error}</p>}
  </section>
}
