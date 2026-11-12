'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { terminalStatuses, type RequestStatus } from '../lib/requests'

export function CaseReviewFields({ available }: { available: RequestStatus[] }) {
  const t = useTranslations('requestsMvp')
  const [status, setStatus] = useState(available[0])
  const terminal = terminalStatuses.includes(status)
  const clarification = status === 'clarification'
  return <>
    <label>{t('nextStatus')}
      <select name="status" required value={status}
        onChange={event => setStatus(event.target.value as RequestStatus)}>
        {available.map(option => <option key={option} value={option}>{t(option)}</option>)}
      </select>
    </label>
    {(terminal || clarification) && <label>
      {terminal ? 'Решение для автора' : 'Вопрос автору'}
      <textarea key={status} name="message" rows={3} maxLength={2000} required />
    </label>}
    {!clarification && <label>
      {t('nextStep')}{terminal ? ' (необязательно)' : ''}
      <input name="nextStep" maxLength={1000} required={!terminal} />
    </label>}
    <button className="button button-primary">
      {terminal ? 'Опубликовать решение' : clarification ? 'Запросить уточнение' : 'Сохранить следующий шаг'}
    </button>
  </>
}
