'use client'
import { useTranslations } from 'next-intl'
import { Menu, X } from 'lucide-react'
import { useEffect, useRef, type ReactNode } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'

export function MobileNavigation({ children }: { children: ReactNode }) {
  const ui = useTranslations('ui')
  const dialog = useRef<HTMLDialogElement>(null)
  const pathname = usePathname(), params = useSearchParams().toString()
  const location = pathname + '?' + params
  const previousLocation = useRef(location)
  useEffect(() => {
    if (previousLocation.current !== location) dialog.current?.close()
    previousLocation.current = location
  }, [location])
  useEffect(() => {
    const media = window.matchMedia('(min-width: 1024px)')
    const close = () => { if (media.matches) dialog.current?.close() }
    media.addEventListener('change', close)
    return () => media.removeEventListener('change', close)
  }, [])
  return <>
    <button className="mobile-more" aria-label={ui('openMenu')} aria-haspopup="dialog" onClick={() => dialog.current?.showModal()}><Menu size={20} /><span>{ui('moreSections')}</span></button>
    <dialog ref={dialog} className="mobile-nav-sheet" aria-labelledby="mobile-nav-title" onClick={e => { if (e.target === e.currentTarget) dialog.current?.close() }}>
      <header><strong id="mobile-nav-title">{ui('workspaceSections')}</strong><button aria-label={ui('closeMenu')} onClick={() => dialog.current?.close()}><X size={20} /></button></header>
      <nav onClick={e => { if ((e.target as HTMLElement).closest('a')) dialog.current?.close() }}>{children}</nav>
    </dialog>
  </>
}
