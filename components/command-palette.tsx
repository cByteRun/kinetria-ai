'use client'
import { useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Search, ArrowUpRight, LayoutDashboard, Inbox, PlusCircle, CheckCheck, ChartNoAxesCombined, Tags, Bell, GitBranch, HelpCircle } from 'lucide-react'
import { setLocale } from '../i18n/actions'
import { locales } from '../i18n/settings'
import { canViewInsights, type Role } from '../lib/roles'
export type SearchRequest = { id: string; title: string; number: number; source_ref: string | null }
export function CommandPalette({ role, requests }: { role: Role; requests: SearchRequest[] }) {
  const ui = useTranslations('ui'), t = useTranslations('command'), shell = useTranslations('dashboardShell'), product = useTranslations('productExpansion'), topics = useTranslations('topicWorkbench')
  const trigger = useRef<HTMLButtonElement>(null)
  const router = useRouter(), dialog = useRef<HTMLDialogElement>(null), input = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState(''), [active, setActive] = useState(0)
  const [pending, startTransition] = useTransition()
  const [shortcut, setShortcut] = useState('Ctrl+K')
  const items = [
    { id: 'lifecycle', title: shell('lifecycle'), description: t('registry'), icon: GitBranch },
    { id: 'portal', title: ui('clientPortal'), description: '/feedback', icon: Inbox },
    { id: 'theme', title: t('theme'), description: t('preferences'), icon: HelpCircle },
    ...locales.map(locale => ({ id: 'language-' + locale, title: t('language') + ' · ' + locale.toUpperCase(), description: t('preferences'), icon: HelpCircle })),
    { id: 'profile', title: shell('profile'), description: t('preferences'), icon: HelpCircle },
    { id: 'overview', title: ui('overview'), description: t('overview'), icon: LayoutDashboard },
    { id: 'registry', title: ui('requests'), description: t('registry'), icon: Inbox },
    ...(role === 'employee' ? [{ id: 'new', title: ui('newRequest'), description: t('new'), icon: PlusCircle }] : []),
    { id: 'results', title: ui('results'), description: t('results'), icon: CheckCheck },
    ...(canViewInsights(role) ? [
      ...(role === 'admin' || role === 'manager' ? [{ id: 'qvin', title: product('askQvin'), description: t('registry'), icon: HelpCircle }] : []),
      { id: 'topic', title: topics('generate'), description: ui('recurringTopics'), icon: Tags },
      { id: 'analytics', title: ui('analytics'), description: t('analytics'), icon: ChartNoAxesCombined },
      { id: 'insights', title: ui('recurringTopics'), description: t('insights'), icon: Tags },
    ] : []),
    { id: 'notifications', title: ui('notifications'), description: t('notifications'), icon: Bell },
    ...(role === 'admin' ? [
      { id: 'categories', title: ui('categories'), description: t('categories'), icon: Tags },
      { id: 'routing', title: ui('routing'), description: t('routing'), icon: GitBranch },
    ] : []),
    { id: 'help', title: ui('howRoutingWorks'), description: t('help'), icon: HelpCircle },
  ]
  const needle = query.trim().toLocaleLowerCase()
  const filtered = [
    ...items.filter(i => (i.title + ' ' + i.description).toLocaleLowerCase().includes(needle)),
    ...(needle ? requests.filter(r => `${r.source_ref || ''} R-${String(r.number).padStart(3, '0')} ${r.id} ${r.title}`.toLocaleLowerCase().includes(needle)).map(r => ({ id: 'request:' + r.id, title: r.title, description: r.source_ref || 'R-' + String(r.number).padStart(3, '0'), icon: Inbox })) : []),
  ]
  function open() { setQuery(''); setActive(0); dialog.current?.showModal(); input.current?.focus() }
  useEffect(() => {
    setShortcut(/Mac|iPhone|iPad/.test(navigator.platform) ? '⌘K' : 'Ctrl+K')
    function key(e: KeyboardEvent) { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); if (dialog.current?.open) dialog.current.close(); else open() } }
    document.addEventListener('keydown', key)
    return () => document.removeEventListener('keydown', key)
  }, [])
  useEffect(() => { document.getElementById('cmd-' + filtered[active]?.id)?.scrollIntoView({ block: 'nearest' }) }, [active, query])
  function go(id: string) {
    dialog.current?.close()
    if (id === 'theme') { document.querySelector<HTMLButtonElement>('.global-header .theme-toggle')?.click(); return }
    const locale = locales.find(locale => id === 'language-' + locale)
    if (locale) { startTransition(() => setLocale(locale)); return }
    const base = '/workspace/' + role
    router.push(id === 'portal' ? '/feedback' : id.startsWith('request:') ? base + '?view=registry&id=' + encodeURIComponent(id.slice(8)) : id === 'lifecycle' ? base + '?view=registry&mode=board' : id === 'qvin' || id === 'topic' ? base + '?view=registry&action=' + id : base + '?view=' + id)
  }
  return <>
    <button ref={trigger} disabled={pending} className="btn ghost command-trigger" onClick={open} aria-haspopup="dialog" aria-label={t('title')}><Search size={17} /><span>{t('title')}</span><kbd>{shortcut}</kbd></button>
    <dialog ref={dialog} onClose={() => trigger.current?.focus({ preventScroll: true })} className="command-dialog" aria-label={t('title')} onClick={e => { if (e.target === dialog.current) dialog.current.close() }}>
      <div className="command-search"><Search size={20} /><input ref={input} role="combobox" aria-label={t('search')} aria-expanded="true" aria-controls="command-results" aria-activedescendant={filtered[active] ? 'cmd-' + filtered[active].id : undefined} value={query} placeholder={t('search')} onChange={e => { setQuery(e.target.value); setActive(0) }} onKeyDown={e => {
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); setActive(i => filtered.length ? (i + (e.key === 'ArrowDown' ? 1 : -1) + filtered.length) % filtered.length : 0) }
        if (e.key === 'Enter' && filtered[active]) { e.preventDefault(); go(filtered[active].id) }
      }} /><button className="btn ghost sm" onClick={() => dialog.current?.close()} aria-label={t('close')}>Esc</button></div>
      <div role="listbox" id="command-results" className="command-results" aria-label={t('title')}>
        {filtered.map((item, i) => <button type="button" id={'cmd-' + item.id} role="option" aria-selected={active === i} key={item.id} onMouseMove={() => setActive(i)} onClick={() => go(item.id)}><item.icon size={19} /><span><strong>{item.title}</strong><small>{item.description}</small></span><ArrowUpRight size={16} /></button>)}
        {!filtered.length && <p>{t('empty')}</p>}
      </div><p className="command-hint">{t('hint')}</p>
    </dialog>
  </>
}
