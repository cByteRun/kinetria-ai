'use client'

import { useTranslations } from 'next-intl'

import { useEffect, useId, useLayoutEffect, useReducer, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { tourStepsConfig } from '../lib/tour-steps'
import { TELEGRAM_BOT_URL, TELEGRAM_CHANNEL_INVITE_URL } from '../lib/telegram-links'

type State = { step: number; category: string; description: string; title: string; assignee: string; clarification: boolean; reply: string; status: 'draft' | 'assigned' | 'in_progress' | 'resolved'; decision: string; acknowledged: boolean; tab: 'topics' | 'analytics'; question: string; answer: boolean }
function initial(t: (key: string) => string): State { return { step: 0, category: 'catalog', description: t('text001'), title: t('text002'), assignee: '', clarification: false, reply: '', status: 'draft', decision: '', acknowledged: false, tab: 'topics', question: t('text003'), answer: false } }
type Action = { type: 'field'; field: 'category' | 'description' | 'title' | 'assignee' | 'reply' | 'decision' | 'question'; value: string } | { type: 'next' | 'draft' | 'register' | 'assign' | 'clarify' | 'work' | 'resolve' | 'acknowledge' | 'ask' } | { type: 'tab'; value: State['tab'] }
function reducer(s: State, a: Action): State {
  if (a.type === 'field') return { ...s, [a.field]: a.value, ...(a.field === 'question' ? { answer: false } : {}) }
  if (a.type === 'tab') return { ...s, tab: a.value }
  switch (a.type) {
    case 'next': return { ...s, step: Math.min(s.step + 1, 7) }
    case 'draft': return s.description.trim().length >= 10 && s.category ? { ...s, step: 2 } : s
    case 'register': return s.title.trim() && s.description.trim().length >= 10 ? { ...s, step: 3, status: 'assigned' } : s
    case 'clarify': return { ...s, clarification: true }
    case 'assign': return s.assignee && (!s.clarification || s.reply.trim().length >= 10) ? { ...s, step: 5 } : s
    case 'work': return { ...s, status: 'in_progress' }
    case 'resolve': return s.status === 'in_progress' && s.decision.trim().length >= 10 ? { ...s, status: 'resolved' } : s
    case 'acknowledge': return s.status === 'resolved' ? { ...s, acknowledged: true } : s
    case 'ask': return s.question.trim() ? { ...s, answer: true } : s
  }
}

export default function TourDialog({ onFinish }: { onFinish: () => void }) {
  const t = useTranslations('tour')
  const [state, dispatch] = useReducer(reducer, undefined, () => initial(t))
  const dialog = useRef<HTMLDialogElement>(null)
  const heading = useRef<HTMLHeadingElement>(null)
  const maskId = useId()
  const [rects, setRects] = useState<{ x: number; y: number; width: number; height: number }[]>([])
  const step = tourStepsConfig[state.step]
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
  }, [state.step])
  useLayoutEffect(() => {
    let frame = 0
    function measure() {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        const next = step.selectors.flatMap(selector => Array.from(document.querySelectorAll(selector))).flatMap(node => {
          const r = node.getBoundingClientRect()
          return r.width && r.height && r.bottom > 0 && r.top < innerHeight ? [{ x: r.x - 5, y: r.y - 5, width: r.width + 10, height: r.height + 10 }] : []
        })
        setRects(next)
      })
    }
    const observer = new ResizeObserver(measure)
    if (dialog.current) observer.observe(dialog.current)
    document.querySelectorAll(step.selectors.join(',') || '[data-tour="none"]').forEach(node => observer.observe(node))
    measure()
    window.addEventListener('resize', measure)
    window.addEventListener('scroll', measure, true)
    return () => { cancelAnimationFrame(frame); observer.disconnect(); window.removeEventListener('resize', measure); window.removeEventListener('scroll', measure, true) }
  }, [step, state.status, state.clarification, state.answer, state.tab, state.acknowledged])
  const field = (name: Extract<Action, { type: 'field' }>['field'], value: string) => dispatch({ type: 'field', field: name, value })
  const next = () => dispatch({ type: 'next' })
  const category = state.category === 'catalog' ? t('text004') : t('text005')
  const status = { draft: t('text006'), assigned: t('text007'), in_progress: t('text008'), resolved: t('text009') }[state.status]
  return createPortal(<dialog ref={dialog} className="tour-dialog" aria-labelledby="tour-heading" onCancel={e => { e.preventDefault(); onFinish() }}>
    <svg className="tour-shade" aria-hidden="true" width="100%" height="100%">
      <defs><mask id={maskId}><rect width="100%" height="100%" fill="white" />{rects.map((r, i) => <rect key={i} {...r} rx="12" fill="black" />)}</mask></defs>
      <rect width="100%" height="100%" fill="rgba(8,15,35,.72)" mask={`url(#${maskId})`} />
      {rects.map((r, i) => <rect key={i} {...r} rx="12" fill="none" stroke="#a5b4fc" strokeWidth="2" />)}
    </svg>
    <div className={'tour-layout' + ([0, 7].includes(state.step) ? ' tour-centered' : '')}>
      <section className="tour-coach">
        <div className="tour-topline"><span>TRY IN 3 MINUTES</span><button type="button" className="tour-close" onClick={onFinish} aria-label={t('text010')}>✕</button></div>
        <p className="tour-role">{state.step + 1} / {tourStepsConfig.length} · {t(step.role)}</p>
        <h2 id="tour-heading" ref={heading} tabIndex={-1}>{t(step.title)}</h2>
        <p>{t(step.text)}</p>
        <div className="tour-progress" aria-label={t('text011', { value0: state.step + 1 })}>{tourStepsConfig.map((item, i) => <span key={item.id} data-done={i <= state.step} />)}</div>
        <small className="tour-disclaimer">{t('text012')}</small>
        {[1, 2, 4, 5, 6].includes(state.step) && <button className="tour-secondary tour-jump" type="button" onClick={() => document.getElementById('tour-action')?.scrollIntoView({ block: 'start', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' })}>{t('goToAction')}</button>}
        {state.step === 0 && <button className="tour-primary" onClick={next}>{t('text013')}</button>}
        {state.step === 3 && <button className="tour-primary" onClick={next}>{t('text014')}</button>}
        {state.step === 5 && state.acknowledged && <button className="tour-primary" onClick={next}>{t('text015')}</button>}
        {state.step === 6 && <button className="tour-primary" onClick={next}>{t('text016')}</button>}
        {state.step === 7 && <><div className="tour-links"><a href={TELEGRAM_BOT_URL} target="_blank" rel="noreferrer">{t('text017')}</a><a href={TELEGRAM_CHANNEL_INVITE_URL} target="_blank" rel="noreferrer">{t('text018')}</a><a href="https://github.com/cByteRun/kinetria-ai/blob/main/docs/JUDGES_GUIDE.md" target="_blank" rel="noreferrer">{t('text019')}</a></div><p>{t('text020')}<a href="/feedback" onClick={onFinish}>/feedback</a>{t('text021')}</p><button className="tour-primary" onClick={onFinish}>{t('text010')}</button></>}
      </section>
      {state.step > 0 && state.step < 7 && <section id="tour-action" className="tour-stage" aria-label={t('text022')}>
        <div className="tour-stage-heading"><strong>{t('text023')}</strong><span>{t(step.role)}</span></div>
        {state.step === 1 && <form data-tour="compose" onSubmit={e => { e.preventDefault(); dispatch({ type: 'draft' }) }}>
          <h3>{t('text024')}</h3>
          <label>{t('text025')}<select value={state.category} onChange={e => field('category', e.target.value)}><option value="catalog">{t('text004')}</option><option value="collaboration">{t('text005')}</option></select></label>
          <label>{t('text026')}<textarea required minLength={10} maxLength={4000} rows={5} value={state.description} onChange={e => field('description', e.target.value)} /></label>
          <p>{t('text027')}</p>
          <button className="tour-primary" type="submit">{t('text028')}</button>
        </form>}
        {state.step >= 2 && state.step <= 5 && <div className="tour-card" data-tour={state.step === 2 ? 'draft' : 'summary'}>
          <div className="tour-card-header"><span>{state.step === 2 ? t('text029') : t('text030')}</span><strong role="status">{status}</strong></div>
          {state.step === 2 ? <form onSubmit={e => { e.preventDefault(); dispatch({ type: 'register' }) }}>
            <p className="tour-example">{t('text031')}</p>
            <label>{t('text032')}<input required maxLength={200} value={state.title} onChange={e => field('title', e.target.value)} /></label>
            <label>{t('text025')}<select value={state.category} onChange={e => field('category', e.target.value)}><option value="catalog">{t('text004')}</option><option value="collaboration">{t('text005')}</option></select></label>
            <label>{t('text033')}<textarea required minLength={10} rows={4} value={state.description} onChange={e => field('description', e.target.value)} /></label>
            <button data-tour="register" className="tour-primary" type="submit">{t('text034')}</button>
          </form> : <><h3>{state.title}</h3><p>{state.description}</p><dl className="tour-metadata"><div><dt>{t('text035')}</dt><dd>{t('text036')}</dd></div><div><dt>{t('text025')}</dt><dd>{category}</dd></div><div><dt>{t('text037')}</dt><dd>{t('text038')}</dd></div><div><dt>SLA</dt><dd>{t('text039')}</dd></div><div><dt>{t('text040')}</dt><dd>{state.assignee || t('text041')}</dd></div></dl></>}
          {state.step === 4 && <form data-tour="assignee" onSubmit={e => { e.preventDefault(); dispatch({ type: 'assign' }) }}>
            <label>{t('text040')}<select aria-label={t('text040')} required value={state.assignee} onChange={e => field('assignee', e.target.value)}><option value="">{t('text042')}</option><option value={t('text043')}>{t('text043')}</option><option value={t('text044')}>{t('text044')}</option></select></label>
            {!state.clarification && <button className="tour-secondary" type="button" onClick={() => dispatch({ type: 'clarify' })}>{t('text045')}</button>}
            {state.clarification && <div className="tour-clarification"><strong>{t('text046')}</strong><p>{t('text047')}</p><label>{t('text048')}<textarea required minLength={10} rows={2} value={state.reply} onChange={e => field('reply', e.target.value)} placeholder={t('text049')} /></label></div>}
            <button className="tour-primary" type="submit">{t('text050')}</button>
          </form>}
          {state.step === 5 && <div data-tour="resolution">
            <p className="tour-role">{state.status === 'resolved' ? t('text051') : t('text052', { value0: state.assignee })}</p>
            {state.status === 'assigned' && <button className="tour-primary" onClick={() => dispatch({ type: 'work' })}>{t('text053')}</button>}
            {state.status === 'in_progress' && <form onSubmit={e => { e.preventDefault(); dispatch({ type: 'resolve' }) }}><label>{t('text054')}<textarea required minLength={10} maxLength={4000} rows={4} value={state.decision} onChange={e => field('decision', e.target.value)} placeholder={t('text055')} /></label><button className="tour-secondary" type="button" onClick={() => field('decision', t('text056'))}>{t('text057')}</button><button className="tour-primary" type="submit">{t('text058')}</button></form>}
            {state.status === 'resolved' && <><h4>{t('text059')}</h4><p>{state.decision}</p><p role="status">{state.acknowledged ? t('text060') : t('text061')}</p>{!state.acknowledged && <button className="tour-primary" onClick={() => dispatch({ type: 'acknowledge' })}>{t('text062')}</button>}</>}
          </div>}
          {state.step >= 3 && <details className="tour-history"><summary>{t('text063')}</summary><ol><li>{t('text064')}</li><li>{t('text065')}</li>{state.clarification && <li>{t('text066')} {state.reply ? t('text067', { value0: state.reply }) : t('text068')}</li>}{state.step >= 5 && <li>{t('text069')} {state.assignee}.</li>}{state.status === 'in_progress' || state.status === 'resolved' ? <li>{t('text070')}</li> : null}{state.status === 'resolved' && <li>{t('text071')}</li>}{state.acknowledged && <li>{t('text072')}</li>}</ol></details>}
        </div>}
        {state.step === 6 && <><div className="tour-tabs" data-tour="insights"><button aria-pressed={state.tab === 'topics'} onClick={() => dispatch({ type: 'tab', value: 'topics' })}>{t('text073')}</button><button aria-pressed={state.tab === 'analytics'} onClick={() => dispatch({ type: 'tab', value: 'analytics' })}>{t('text074')}</button></div>
          <div className="tour-example">{t('text075')}</div>
          {state.tab === 'topics' ? <div><h3>{t('text076')}</h3><p>{t('text077')}</p></div> : <dl className="tour-metadata"><div><dt>{t('text078')}</dt><dd>2</dd></div><div><dt>{t('text079')}</dt><dd>DEMO-003</dd></div><div><dt>{t('text080')}</dt><dd>{t('text081')}</dd></div></dl>}
          <form data-tour="qvin" onSubmit={e => { e.preventDefault(); dispatch({ type: 'ask' }) }}><h3>{t('text082')}</h3><label>{t('text083')}<textarea rows={2} required maxLength={1000} value={state.question} onChange={e => field('question', e.target.value)} /></label><button className="tour-primary" type="submit">{t('text084')}</button>{state.answer && <div className="tour-answer" role="status"><strong>{t('text085')}</strong><p>{t('text086')}</p></div>}</form>
        </>}
      </section>}
    </div>
  </dialog>, document.body)
}
