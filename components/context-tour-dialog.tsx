'use client'

import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslations } from 'next-intl'
import { generateTourSteps, type TourRole } from '../lib/tour-steps'

type Rect = { x: number; y: number; width: number; height: number }
function visible(selector?: string) {
  if (!selector) return undefined
  return Array.from(document.querySelectorAll<HTMLElement>(selector)).find(node => {
    const box = node.getBoundingClientRect()
    return box.width > 0 && box.height > 0 && getComputedStyle(node).visibility !== 'hidden'
  })
}

export default function ContextTourDialog({ role, route, onFinish }: { role: TourRole; route: string; onFinish: () => void }) {
  const t = useTranslations('tour')
  const steps = useMemo(() => generateTourSteps(role, route), [role, route])
  const [index, setIndex] = useState(0)
  const [ready, setReady] = useState(false)
  const [rect, setRect] = useState<Rect | null>(null)
  const panel = useRef<HTMLDialogElement>(null)
  const heading = useRef<HTMLHeadingElement>(null)
  const touchY = useRef<number | null>(null)
  const mask = useId()
  const step = steps[index]

  // Route navigation and streamed Overview rendering may complete after the click.
  useEffect(() => {
    const check = () => setReady(Boolean(document.querySelector(`[data-tour-overview="${role}"]`)))
    const observer = new MutationObserver(check)
    observer.observe(document.body, { childList: true, subtree: true })
    check()
    return () => observer.disconnect()
  }, [role])

  useEffect(() => {
    if (!ready) return
    const previous = document.activeElement as HTMLElement | null
    const dialog = panel.current
    dialog?.showModal()
    return () => {
      dialog?.close()
      if (previous?.isConnected) previous.focus({ preventScroll: true })
    }
  }, [ready])

  useLayoutEffect(() => {
    if (!ready || !step) return
    const target = visible(step.selector) || visible(step.fallback)
    if (!target) {
      if (index < steps.length - 1) setIndex(value => value + 1)
      return
    }
    target.scrollIntoView({ block: 'start', behavior: 'instant' })
    heading.current?.focus({ preventScroll: true })
    let frame = 0
    const measure = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        const node = visible(step.selector) || visible(step.fallback)
        if (!node) { setRect(null); return }
        const box = node.getBoundingClientRect()
        setRect({ x: box.x - 4, y: box.y - 4, width: box.width + 8, height: box.height + 8 })
      })
    }
    const observer = new ResizeObserver(measure)
    observer.observe(target)
    const mutations = new MutationObserver(measure)
    mutations.observe(target, { childList: true, subtree: true })
    window.addEventListener('resize', measure)
    window.addEventListener('scroll', measure, true)
    measure()
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      mutations.disconnect()
      window.removeEventListener('resize', measure)
      window.removeEventListener('scroll', measure, true)
    }
  }, [ready, step, index, steps.length])

  const go = (direction: number) => {
    let next = index + direction
    while (next > 0 && next < steps.length - 1 && !visible(steps[next].selector) && !visible(steps[next].fallback)) next += direction
    setIndex(Math.max(0, Math.min(steps.length - 1, next)))
  }

  if (!ready || !step) return null
  const empty = step.id === 'focus' && document.querySelector('[data-tour="overview-focus"]')?.getAttribute('data-tour-empty') === 'true'
  return createPortal(<dialog ref={panel} className="tour-dialog tour-context-dialog" aria-labelledby="context-tour-heading" onCancel={event => { event.preventDefault(); onFinish() }}
    onWheel={event => {
      if (!(event.target as Element).closest('.tour-coach')) { event.preventDefault(); window.scrollBy({ top: event.deltaY, behavior: 'instant' }) }
    }}
    onTouchStart={event => { if (!(event.target as Element).closest('.tour-coach')) touchY.current = event.touches[0]?.clientY ?? null }}
    onTouchMove={event => {
      const y = event.touches[0]?.clientY
      if (touchY.current !== null && y !== undefined && !(event.target as Element).closest('.tour-coach')) {
        window.scrollBy({ top: touchY.current - y, behavior: 'instant' })
        touchY.current = y
      }
    }} onTouchEnd={() => { touchY.current = null }}>
    <svg className="tour-shade" aria-hidden="true" width="100%" height="100%">
      <defs><mask id={mask}><rect width="100%" height="100%" fill="white" />{rect && <rect {...rect} rx="12" fill="black" />}</mask></defs>
      <rect width="100%" height="100%" fill="rgba(8,15,35,.64)" mask={`url(#${mask})`} />
      {rect && <rect {...rect} rx="12" fill="none" stroke="#a5b4fc" strokeWidth="3" />}
    </svg>
    <section className="tour-coach tour-context-coach" data-placement={rect && rect.y > window.innerHeight / 2 ? 'top' : 'bottom'}>
      <div className="tour-topline"><span>{t(`context.${role}.button`)}</span><button className="tour-close" onClick={onFinish} aria-label={t('text010')}>✕</button></div>
      <p className="tour-role">{index + 1} / {steps.length} · {t('context.personal')}</p>
      <h2 id="context-tour-heading" ref={heading} tabIndex={-1}>{t(step.title)}</h2>
      <p>{t(empty ? `context.${role}.emptyFocus` : step.text)}</p>
      <div className="tour-progress">{steps.map((item, i) => <span key={item.id} data-done={i <= index} />)}</div>
      <div className="tour-context-actions">
        {index > 0 && <button className="tour-secondary" onClick={() => go(-1)}>{t('context.back')}</button>}
        <button className="tour-primary" onClick={() => index === steps.length - 1 ? onFinish() : go(1)}>{t(index === steps.length - 1 ? 'context.done' : 'context.next')}</button>
      </div>
    </section>
  </dialog>, document.body)
}
