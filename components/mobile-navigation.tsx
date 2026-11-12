'use client'
import { Menu, X } from 'lucide-react'
import { useState } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { useEffect } from 'react'
export function MobileNavigation() {
  const [open, setOpen] = useState(false)
  const pathname = usePathname(),
    params = useSearchParams().toString()
  useEffect(() => {
    setOpen(false)
  }, [pathname, params])
  return (
    <>
      <button
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
            {'.ir-app .sidebar{visibility:visible;transform:translateX(0)}'}
          </style>
        </>
      )}
    </>
  )
}
