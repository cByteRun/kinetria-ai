'use client'

import { useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Preferences } from './preferences'
import type { Theme } from '../i18n/settings'
import Link from 'next/link'
import { ArrowUpRight } from 'lucide-react'
import { Brand } from './brand'

const sections = ['product', 'how', 'pricing', 'contact'] as const

export function LandingHeader({ theme }: { theme: Theme }) {
  const t = useTranslations('landing')
  const header = useRef<HTMLElement>(null)
  const bar = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState<(typeof sections)[number]>(sections[0])

  useEffect(() => {
    let frame = 0
    function update() {
      const root = document.documentElement
      const remaining = root.scrollHeight - root.clientHeight
      const progress =
        remaining > 0 ? Math.min(1, Math.max(0, window.scrollY / remaining)) : 0
      if (bar.current) bar.current.style.transform = `scaleX(${progress})`

      const threshold = (header.current?.offsetHeight ?? 0) + 28
      const current = sections.findLast((id) => {
        const section = document.getElementById(id)
        return section && section.getBoundingClientRect().top <= threshold
      })
      setActive(progress >= 0.999 ? 'contact' : (current ?? sections[0]))
    }

    function schedule() {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(update)
    }

    schedule()
    window.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule)
    const observer = new ResizeObserver(schedule)
    observer.observe(document.body)
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      window.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
    }
  }, [])

  return (
    <header ref={header} className="landing-header">
      <div className="landing-progress" aria-hidden="true">
        <div ref={bar} />
      </div>
      <div className="container landing-nav">
        <Brand />
        <nav aria-label={t('nav')}>
          {sections.map((id) => (
            <a
              key={id}
              href={`#${id}`}
              aria-current={active === id ? 'location' : undefined}
            >
              {t(id)}
            </a>
          ))}
        </nav>
        <Link className="landing-button landing-button-secondary" href="/login">
          {t('try')} <ArrowUpRight size={16} />
        </Link>
        <Preferences theme={theme} />
      </div>
    </header>
  )
}
