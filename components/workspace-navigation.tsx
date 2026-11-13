'use client'

import Link, { useLinkStatus } from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useState, type ReactNode } from 'react'

function PendingMark() {
  const { pending } = useLinkStatus()
  return pending ? <span className="nav-pending" aria-hidden="true" /> : null
}

export function WorkspaceNavLink({ href, view, children, mobile = false }: {
  href: string; view: string; children: ReactNode; mobile?: boolean
}) {
  const [intent, setIntent] = useState(false)
  const params = useSearchParams()
  const selected = params.get('view') || (params.has('id') ? 'registry' : 'overview')
  const active = view === 'lifecycle'
    ? selected === 'registry' && params.get('mode') === 'board'
    : selected === view && !(view === 'registry' && params.get('mode') === 'board')
  return <Link href={href} prefetch={intent ? true : null} onMouseEnter={() => setIntent(true)} onFocus={() => setIntent(true)} className={mobile ? undefined : 'nav-link' + (active ? ' active' : '')}
    aria-current={active ? 'page' : undefined}>
    {children}<PendingMark />
  </Link>
}

export function WorkspaceCrumbs({ base, employee }: { base: string; employee: boolean }) {
  const ui = useTranslations('ui')
  const shell = useTranslations('dashboardShell')
  const params = useSearchParams()
  const view = params.get('view') || (params.has('id') ? 'registry' : 'overview')
  const labels: Record<string, string> = {
    profile: shell('profile'), overview: ui('overview'), registry: ui(employee ? 'myRequests' : 'requests'), new: ui('newRequest'),
    results: ui('results'), analytics: ui('analytics'), insights: ui('recurringTopics'),
    routing: ui('routing'), categories: ui('categories'), notifications: ui('notifications'), help: ui('howRoutingWorks'),
  }
  return <div className="crumbs">
    <Link className="crumb-root" href={base + '?view=overview'}>{ui('workspace')}</Link>
    <span aria-hidden="true">/</span>
    <strong>{params.has('id') ? ui('request') : view === 'registry' && params.get('mode') === 'board' ? shell('lifecycle') : labels[view] || ui('request')}</strong>
  </div>
}
