'use client'

import Link from 'next/link'
import { useState } from 'react'
import { Search, ArrowUpDown, Star, Inbox } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { statuses, type RequestStatus } from '../lib/requests'

export type RegistryRow = {
  id: string; number: number; source_ref: string | null; title: string;
  status: RequestStatus; category_id: string; assignee_id: string | null; updated_at?: string
}

function requestNumber(row: RegistryRow) {
  return row.source_ref ?? 'R-' + String(row.number).padStart(3, '0')
}

export function RequestRegistry({ rows, categories, path }: {
  rows: RegistryRow[]; categories: Record<string, string>; path: string
}) {
  const t = useTranslations('requestsMvp')
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('')
  const [category, setCategory] = useState('')
  const [ascending, setAscending] = useState(false)
  const [favorites, setFavorites] = useState<string[]>([])
  const [onlyFavorites, setOnlyFavorites] = useState(false)
  const filtered = rows.filter(row => (!status || row.status === status) && (!category || row.category_id === category)
    && (!onlyFavorites || favorites.includes(row.id))
    && (row.title + ' ' + requestNumber(row)).toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()))
    .sort((a, b) => ascending ? a.number - b.number : b.number - a.number)
  return <section className="crm-registry">
    <div className="crm-toolbar">
      <label className="crm-search"><Search size={17} /><input placeholder="Поиск по теме или номеру" aria-label="Поиск обращений" value={query} onChange={e => setQuery(e.target.value)} /></label>
      <select aria-label="Фильтр по статусу" value={status} onChange={e => setStatus(e.target.value)}><option value="">Все статусы</option>{statuses.map(s => <option key={s} value={s}>{t(s)}</option>)}</select>
      <select aria-label="Фильтр по категории" value={category} onChange={e => setCategory(e.target.value)}><option value="">Все категории</option>{Object.entries(categories).map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select>
      <button aria-pressed={ascending} onClick={() => setAscending(!ascending)}><ArrowUpDown size={16} />По номеру</button>
      <button aria-pressed={onlyFavorites} onClick={() => setOnlyFavorites(!onlyFavorites)}><Star size={16} />Избранное</button>
    </div>
    <div className="crm-table-scroll"><table><thead><tr><th aria-label="Избранное" /><th>ID</th><th>Тема обращения</th><th>Статус</th><th>Категория</th><th>Назначение</th></tr></thead>
      <tbody>{filtered.map(row => <tr key={row.id}>
        <td><button className="crm-star" aria-label="В избранное" aria-pressed={favorites.includes(row.id)} onClick={() => setFavorites(previous => previous.includes(row.id) ? previous.filter(id => id !== row.id) : [...previous, row.id])}><Star size={15} fill={favorites.includes(row.id) ? 'currentColor' : 'none'} /></button></td>
        <td><Link scroll={false} href={path + '?view=registry&id=' + row.id}>{requestNumber(row)}</Link></td>
        <td><Link scroll={false} href={path + '?view=registry&id=' + row.id}>{row.title}</Link></td>
        <td><span className={'crm-status status-' + row.status}>{t(row.status)}</span></td>
        <td>{categories[row.category_id]}</td><td>{row.assignee_id ? 'Назначен' : 'Резервная очередь'}</td>
      </tr>)}</tbody></table></div>
    {!filtered.length && <div className="crm-empty"><Inbox size={28} /><p>Обращений по выбранным условиям нет</p></div>}
    <footer className="crm-table-footer">Показано {filtered.length} из {rows.length}</footer>
  </section>
}
