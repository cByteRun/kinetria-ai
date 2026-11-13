'use client'

import { useTranslations } from 'next-intl'

import { createContext, lazy, Suspense, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { Play, RotateCcw, Settings, BriefcaseBusiness, UserRound, ClipboardCheck } from 'lucide-react'
import { TOUR_COMPLETED_KEY, tourRoleFromPath } from '../lib/tour-steps'

const ContextTourDialog = lazy(() => import('./context-tour-dialog'))
const TourDialog = lazy(() => import('./tour-dialog'))
const TourContext = createContext<() => void>(() => {})

function completed() {
  try { if (localStorage.getItem(TOUR_COMPLETED_KEY) === 'true') return true } catch { /* cookie fallback */ }
  return document.cookie.split(';').some(value => value.trim() === TOUR_COMPLETED_KEY + '=true')
}

export function TourProvider({ children }: { children: ReactNode }) {
  const [active, setActive] = useState<string | null>(null)
  const [run, setRun] = useState(0)
  const router = useRouter()
  const path = usePathname()
  const role = tourRoleFromPath(path)
  const start = useCallback(() => {
    setRun(value => value + 1)
    setActive(path)
    if (role) router.push(`/workspace/${role}?view=overview`, { scroll: true })
  }, [path, role, router])
  useEffect(() => {
    if (!completed() && !path.startsWith('/auth/')) start()
    else setActive(null)
  }, [path, start])
  const finish = useCallback(() => {
    try { localStorage.setItem(TOUR_COMPLETED_KEY, 'true') } catch { /* cookie fallback */ }
    document.cookie = `${TOUR_COMPLETED_KEY}=true; Path=/; Max-Age=31536000; SameSite=Lax`
    setActive(null)
  }, [])
  return <TourContext.Provider value={start}>
    {children}
    {active === path && <Suspense fallback={null}>{role ? <ContextTourDialog key={`${role}:${run}`} role={role} route={path} onFinish={finish} /> : <TourDialog key={run} onFinish={finish} />}</Suspense>}
  </TourContext.Provider>
}

export function TourStartButton({ reset = false }: { reset?: boolean }) {
  const t = useTranslations('tour')
  const start = useContext(TourContext)
  const role = tourRoleFromPath(usePathname())
  const Icon = role ? { admin: Settings, manager: BriefcaseBusiness, employee: UserRound, handler: ClipboardCheck }[role] : Play
  const label = reset ? t('text089') : role ? t(`context.${role}.button`) : 'Try in 3 minutes'
  return <button type="button" onClick={event => {
    event.currentTarget.closest<HTMLDialogElement>('dialog.mobile-nav-sheet')?.close()
    start()
  }} data-tour={reset ? 'reset' : 'start'} aria-haspopup="dialog"
    className={reset ? 'nav-link tour-reset' : `tour-trigger${role ? ` tour-trigger-${role}` : ''}`}
    aria-label={label} title={label}>
    {reset ? <RotateCcw size={16} /> : <Icon size={16} />}
    <span>{label}</span>
    {!reset && role && <small className="tour-personal-badge">{t('context.personal')}</small>}
    {!reset && <i aria-hidden="true" />}
  </button>
}
