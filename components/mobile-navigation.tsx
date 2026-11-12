'use client'
import { Menu, X } from 'lucide-react'
import { useRef, useState } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { useEffect } from 'react'
export function MobileNavigation() {
  const [open, setOpen] = useState(false)
  const toggle = useRef<HTMLButtonElement>(null)
  const pathname = usePathname(),
    params = useSearchParams().toString()
  useEffect(() => {
    setOpen(false)
  }, [pathname, params])
  useEffect(() => {
    if (!open) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const sidebar = document.getElementById('workspace-navigation')
    const focusable = () =>
      Array.from(
        sidebar?.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled])',
        ) || [],
      )
    focusable()[0]?.focus()
    function handleKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false)
        toggle.current?.focus()
      }
      if (event.key !== 'Tab') return
      const elements = [toggle.current, ...focusable()].filter(
        Boolean,
      ) as HTMLElement[]
      const index = elements.indexOf(document.activeElement as HTMLElement)
      if (event.shiftKey && index <= 0) {
        event.preventDefault()
        elements.at(-1)?.focus()
      } else if (!event.shiftKey && index === elements.length - 1) {
        event.preventDefault()
        elements[0]?.focus()
      }
    }
    const desktop = window.matchMedia('(min-width: 741px)')
    const closeOnDesktop = () => {
      if (desktop.matches) setOpen(false)
    }
    desktop.addEventListener('change', closeOnDesktop)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.body.style.overflow = previous
      document.removeEventListener('keydown', handleKey)
      desktop.removeEventListener('change', closeOnDesktop)
    }
  }, [open])
  return (
    <>
      <button
        ref={toggle}
        aria-controls="workspace-navigation"
        className="ir-mobile-toggle"
        onClick={() => setOpen(!open)}
        aria-label={open ? 'Закрыть меню' : 'Открыть меню'}
        aria-expanded={open}
      >
        {open ? <X /> : <Menu />}
      </button>
      {open && (
        <>
          <button
            className="ir-scrim"
            aria-label="Закрыть меню"
            onClick={() => setOpen(false)}
          />
          <style>
            {
              '.ir-app .sidebar{visibility:visible;transform:translateX(0)}'
            }
          </style>
        </>
      )}
    </>
  )
}
