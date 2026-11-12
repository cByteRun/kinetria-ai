'use client'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Search, ArrowUpRight, LayoutDashboard, Inbox, PlusCircle, CheckCheck, ChartNoAxesCombined, Tags, Bell, GitBranch, HelpCircle } from 'lucide-react'
import { canViewInsights, type Role } from '../lib/roles'
export function CommandPalette({ role }: { role: Role }) {
  const ui = useTranslations('ui'), t = useTranslations('command')
  const router = useRouter(), dialog = useRef<HTMLDialogElement>(null), input = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState(''), [active, setActive] = useState(0)
  const items = [
    { id: 'overview', title: ui('overview'), description: t('overview'), icon: LayoutDashboard },
    { id: 'registry', title: ui('requests'), description: t('registry'), icon: Inbox },
    ...(role === 'employee' ? [{ id: 'new', title: ui('newRequest'), description: t('new'), icon: PlusCircle }] : []),
    { id: 'results', title: ui('results'), description: t('results'), icon: CheckCheck },
    ...(canViewInsights(role) ? [
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
  const filtered = items.filter(i => (i.title + ' ' + i.description).toLocaleLowerCase().includes(query.toLocaleLowerCase()))
  function open() { setQuery(''); setActive(0); dialog.current?.showModal(); input.current?.focus() }
  useEffect(() => {
    function key(e: KeyboardEvent) { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); if (dialog.current?.open) dialog.current.close(); else open() } }
    document.addEventListener('keydown', key)
    return () => document.removeEventListener('keydown', key)
  }, [])
  function go(id: string) { dialog.current?.close(); router.push('/workspace/' + role + '?view=' + id) }
  return <>
    <button className="btn ghost command-trigger" onClick={open} aria-label={t('title')}><Search size={17} /><span>{t('title')}</span><kbd>Ctrl K</kbd></button>
    <dialog ref={dialog} className="command-dialog" aria-label={t('title')} onClick={e => { if (e.target === dialog.current) dialog.current.close() }}>
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
