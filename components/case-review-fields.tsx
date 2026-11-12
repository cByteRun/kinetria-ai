'use client'

import { useState } from 'react'
import { useFormStatus } from 'react-dom'
import { useTranslations } from 'next-intl'
import { terminalStatuses, type RequestStatus } from '../lib/requests'

export function CaseReviewFields({
  available,
}: {
  available: RequestStatus[]
}) {
  const ui = useTranslations('ui')

  const t = useTranslations('requestsMvp')
  const { pending } = useFormStatus()
  const [status, setStatus] = useState(available[0])
  const terminal = terminalStatuses.includes(status)
  const clarification = status === 'clarification'
  return (
    <>
      <label>
        {t('nextStatus')}
        <select
          name="status"
          disabled={pending}
          required
          value={status}
          onChange={(event) => setStatus(event.target.value as RequestStatus)}
        >
          {available.map((option) => (
            <option key={option} value={option}>
              {t(option)}
            </option>
          ))}
        </select>
      </label>
      {(terminal || clarification) && (
        <label>
          {pending
            ? ui('saving')
            : terminal
              ? ui('decisionForTheAuthor')
              : ui('questionForTheAuthor')}
          <textarea
            disabled={pending}
            key={status}
            name="message"
            rows={3}
            maxLength={2000}
            required
          />
        </label>
      )}
      {!clarification && (
        <label>
          {t('nextStep')}
          {terminal ? ui('optional') : ''}
          <input
            disabled={pending}
            name="nextStep"
            maxLength={1000}
            required={!terminal}
          />
        </label>
      )}
      <button
        className="button button-primary"
        disabled={pending}
        aria-busy={pending}
      >
        {pending
          ? ui('saving')
          : terminal
            ? ui('publishDecision')
            : clarification
              ? ui('requestClarification')
              : ui('saveNextStep')}
      </button>
    </>
  )
}
