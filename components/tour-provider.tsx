'use client'

import { useTranslations } from 'next-intl'

import { createContext, lazy, Suspense, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import { Play, RotateCcw } from 'lucide-react'
import { TOUR_COMPLETED_KEY } from '../lib/tour-steps'

const TourDialog = lazy(() => import('./tour-dialog'))
const TourContext = createContext<() => void>(() => {})

function completed() {
  try { if (localStorage.getItem(TOUR_COMPLETED_KEY) === 'true') return true } catch { /* cookie fallback */ }
  return document.cookie.split(';').some(value => value.trim() === TOUR_COMPLETED_KEY + '=true')
}

export function TourProvider({ children }: { children: ReactNode }) {
  const [active, setActive] = useState(false)
  const path = usePathname()
  const start = useCallback(() => setActive(true), [])
  useEffect(() => {
    if (!completed() && !path.startsWith('/auth/')) setActive(true)
  }, [path])
  const finish = useCallback(() => {
    try { localStorage.setItem(TOUR_COMPLETED_KEY, 'true') } catch { /* cookie fallback */ }
    document.cookie = `${TOUR_COMPLETED_KEY}=true; Path=/; Max-Age=31536000; SameSite=Lax`
    setActive(false)
  }, [])
  return <TourContext.Provider value={start}>
    {children}
    {active && <Suspense fallback={null}><TourDialog onFinish={finish} /></Suspense>}
  </TourContext.Provider>
}

export function TourStartButton({ reset = false }: { reset?: boolean }) {
  const t = useTranslations('tour')
  const start = useContext(TourContext)
  return <button type="button" onClick={start} data-tour={reset ? 'reset' : 'start'} aria-haspopup="dialog"
    className={reset ? 'nav-link tour-reset' : 'tour-trigger'}
    aria-label={reset ? t('text087') : t('text088')} title={reset ? t('text089') : 'Try in 3 minutes'}>
    {reset ? <RotateCcw size={16} /> : <Play size={16} fill="currentColor" />}
    <span>{reset ? t('text089') : 'Try in 3 minutes'}</span>
    {!reset && <i aria-hidden="true" />}
  </button>
}
