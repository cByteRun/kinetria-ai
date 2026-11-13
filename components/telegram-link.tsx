'use client'

import { useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { ExternalLink, Radio, Send } from 'lucide-react'
import { createTelegramLink } from '../app/workspace/telegram-actions'
import { TELEGRAM_BOT_URL, TELEGRAM_CHANNEL_INVITE_URL, TELEGRAM_CHANNEL_WEB_URL } from '../lib/telegram-links'

export function TelegramLink() {
  const t = useTranslations('telegram')
  const [url, setUrl] = useState('')
  const [error, setError] = useState<'session' | 'configuration' | 'database'>()
  const [pending, start] = useTransition()

  function connect() {
    setError(undefined)
    setUrl('')
    start(async () => {
      try {
        const result = await createTelegramLink()
        setError(result.error)
        setUrl(result.url || '')
      } catch {
        setError('database')
      }
    })
  }

  return <section className="card detail-block ir-section-gap telegram-access" aria-labelledby="telegram-access-title">
    <h2 id="telegram-access-title"><Send size={18} aria-hidden="true" /> {t('title')}</h2>
    <p className="form-hint">{t('intro')}</p>
    <div className="telegram-access-grid">
      <article className="telegram-access-panel">
        <h3><Send size={18} aria-hidden="true" /> {t('botTitle')}</h3>
        <p>{t('botDescription')}</p>
        <a className="btn primary" href={TELEGRAM_BOT_URL} target="_blank" rel="noreferrer">{t('openBot')}<ExternalLink size={15} aria-hidden="true" /></a>
        <ol className="telegram-access-steps">
          <li>{t('startStep')}</li>
          <li>{t('existingStep')}</li>
          <li>{t('demoStep')}</li>
        </ol>
      </article>
      <article className="telegram-access-panel">
        <h3><Radio size={18} aria-hidden="true" /> {t('channelTitle')}</h3>
        <p>{t('channelDescription')}</p>
        <p className="form-hint">{t('channelSafety')}</p>
        <div className="telegram-access-actions">
          <a className="btn primary" href={TELEGRAM_CHANNEL_INVITE_URL} target="_blank" rel="noreferrer">{t('joinChannel')}<ExternalLink size={15} aria-hidden="true" /></a>
          <a className="btn" href={TELEGRAM_CHANNEL_WEB_URL} target="_blank" rel="noreferrer">{t('openChannelWeb')}</a>
        </div>
        <p className="form-hint">{t('channelWebHelp')}</p>
      </article>
    </div>
    <details className="telegram-link-fallback">
      <summary>{t('linkHelpTitle')}</summary>
      <p>{t('description')}</p>
      <button className="btn" disabled={pending} aria-busy={pending} onClick={connect}>{pending ? t('pending') : t('connect')}</button>
      {url && <div role="status" className="telegram-link-ready"><p>{t('linkReady')}</p><a className="btn primary" href={url} target="_blank" rel="noreferrer">{t('open')}</a></div>}
      {error && <p role="alert">{t(error + 'Error')}</p>}
    </details>
    <p className="form-hint">{t('accessNote')}</p>
  </section>
}
