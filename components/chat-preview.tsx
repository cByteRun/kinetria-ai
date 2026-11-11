'use client'

import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { ArrowUp, Sparkles } from 'lucide-react'

export function ChatPreview() {
  const t = useTranslations('chat')
  const [message, setMessage] = useState('')
  const [preview, setPreview] = useState('')
  return (
    <section className="chat-panel" aria-label={t('label')}>
      <div className="chat-message">
        <span className="icon-square">
          <Sparkles size={18} />
        </span>
        <p>{t('greeting')}</p>
      </div>
      {preview && (
        <>
          <p className="chat-user">{preview}</p>
          <div className="draft" aria-live="polite">
            <h2>{t('draft')}</h2>
            <p>{preview}</p>
            <small>{t('note')}</small>
          </div>
        </>
      )}
      <form
        className="chat-compose"
        onSubmit={(event) => {
          event.preventDefault()
          if (message.trim()) setPreview(message.trim())
        }}
      >
        <textarea
          aria-label={t('message')}
          placeholder={t('placeholder')}
          rows={2}
          maxLength={2000}
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          required
        />
        <button
          className="button button-primary"
          aria-label={t('show')}
          disabled={!message.trim()}
        >
          <ArrowUp size={20} />
        </button>
      </form>
    </section>
  )
}
