'use client'

import { useTranslations } from 'next-intl'
import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { publicTourSteps } from '../lib/tour-steps'
import { TELEGRAM_BOT_URL, TELEGRAM_CHANNEL_INVITE_URL } from '../lib/telegram-links'

const DemoTourDialog = lazy(() => import('./demo-tour-dialog'))

export default function TourDialog({ onFinish }: { onFinish: () => void }) {
  const [mode, setMode] = useState<'overview' | 'demo'>('overview')
  return mode === 'demo'
    ? <Suspense fallback={null}><DemoTourDialog onFinish={onFinish} onOverview={() => setMode('overview')} /></Suspense>
    : <PublicTourDialog onFinish={onFinish} onTry={() => setMode('demo')} />
}

function PublicTourDialog({ onFinish, onTry }: { onFinish: () => void; onTry: () => void }) {
  const t = useTranslations('tour')
  const [index, setIndex] = useState(0)
  const dialog = useRef<HTMLDialogElement>(null)
  const heading = useRef<HTMLHeadingElement>(null)
  const step = publicTourSteps[index]
  const last = index === publicTourSteps.length - 1
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    const panel = dialog.current
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    panel?.showModal()
    return () => {
      panel?.close()
      document.body.style.overflow = overflow
      previous?.focus({ preventScroll: true })
    }
  }, [])
  useEffect(() => {
    heading.current?.focus({ preventScroll: true })
    dialog.current?.scrollTo({ top: 0 })
  }, [index])
  return createPortal(<dialog ref={dialog} className="tour-dialog" aria-labelledby="public-tour-heading" onCancel={event => { event.preventDefault(); onFinish() }}>
    <div className="tour-shade" style={{ background: 'rgba(8,15,35,.72)' }} aria-hidden="true" />
    <div className="tour-layout tour-centered">
      <section className="tour-coach">
        <div className="tour-topline"><span>TRY IN 3 MINUTES</span><button type="button" className="tour-close" onClick={onFinish} aria-label={t('text010')}>✕</button></div>
        <p className="tour-role">{index + 1} / {publicTourSteps.length}</p>
        <h2 id="public-tour-heading" ref={heading} tabIndex={-1}>{t(`public.${step}Title`)}</h2>
        <p>{t(`public.${step}Text`)}</p>
        {index < 5 && <p className="tour-example">{t('public.guideHint')}</p>}
        <div className="tour-links">
          {(step === 'channel' || last) && <a href={TELEGRAM_CHANNEL_INVITE_URL} target="_blank" rel="noreferrer">{t('public.channelLink')}</a>}
          {(step === 'bot' || last) && <a href={TELEGRAM_BOT_URL} target="_blank" rel="noreferrer">{t('public.botLink')}</a>}
          {last && <a href="/login" onClick={onFinish}>{t('public.login')}</a>}
        </div>
        <div className="tour-progress" aria-label={t('text011', { value0: index + 1 })}>{publicTourSteps.map((item, i) => <span key={item} data-done={i <= index} />)}</div>
        <small className="tour-disclaimer">{t('public.note')}</small>
        {(index === 0 || last) && <>
          <button type="button" className="tour-primary" onClick={onTry}>{t('public.tryNow')}</button>
          <small className="tour-disclaimer">{t('public.tryHint')}</small>
        </>}
        <div className="tour-context-actions">
          {index > 0 && <button type="button" className="tour-secondary" onClick={() => setIndex(value => value - 1)}>{t('public.back')}</button>}
          <button type="button" className="tour-primary" onClick={last ? onFinish : () => setIndex(value => value + 1)}>{t(last ? 'text010' : index === 0 ? 'public.explore' : 'public.next')}</button>
        </div>
      </section>
    </div>
  </dialog>, document.body)
}
