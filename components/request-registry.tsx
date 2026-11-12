'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Search, ArrowUpDown, Star, Inbox, ChevronRight } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { feedbackStage, feedbackStages, requestKindLabels, statuses, terminalStatuses, type RequestStatus } from '../lib/requests'

import { CaseAssignment, CaseCategory, CaseKind, CaseNextStep, CaseStatus } from './case-labels'

export type RegistryRow = {
  id: string; number: number; source_ref: string | null; title: string;
  status: RequestStatus; category_id: string; assignee_id: string | null; updated_at?: string
  description?: string; next_step?: string | null; decision?: string | null; kind: keyof typeof requestKindLabels; sentiment: number | null
}

function requestNumber(row: RegistryRow) {
  return row.source_ref ?? 'R-' + String(row.number).padStart(3, '0')
}

export function RequestRegistry({ rows, categories, path }: {
  rows: RegistryRow[]; categories: Record<string, string>; path: string
}) {
  const t = useTranslations('requestsMvp')
  const router = useRouter()
  const detailHref = (id: string) => path + '?view=registry&id=' + id
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('')
  const [category, setCategory] = useState('')
  const [kind, setKind] = useState('')
  const [assignment, setAssignment] = useState('')
  const [ascending, setAscending] = useState(false)
  const [favorites, setFavorites] = useState<string[]>([])
  const [onlyFavorites, setOnlyFavorites] = useState(false)
  const filtered = rows.filter(row => (!status || row.status === status) && (!category || row.category_id === category)
    && (!kind || row.kind === kind)
    && (!assignment || Boolean(row.assignee_id) === (assignment === 'assigned'))
    && (!onlyFavorites || favorites.includes(row.id))
    && (row.title + ' ' + (row.description || '') + ' ' + requestNumber(row)).toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()))
    .sort((a, b) => ascending ? a.number - b.number : b.number - a.number)
  return <section className="crm-registry">
    <div className="crm-toolbar">
      <label className="crm-search"><Search size={17} /><input placeholder="Тема, описание или номер" aria-label="Поиск обращений" value={query} onChange={e => setQuery(e.target.value)} /></label>
      <select aria-label="Фильтр по статусу" value={status} onChange={e => setStatus(e.target.value)}><option value="">Все статусы</option>{statuses.map(s => <option key={s} value={s}>{t(s)}</option>)}</select>
      <select aria-label="Фильтр по категории" value={category} onChange={e => setCategory(e.target.value)}><option value="">Все категории</option>{Object.entries(categories).map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select>
      <select aria-label="Фильтр по типу" value={kind} onChange={e => setKind(e.target.value)}>
        <option value="">Все типы</option>
        {Object.entries(requestKindLabels).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
      </select>
      <select aria-label="Фильтр по назначению" value={assignment} onChange={e => setAssignment(e.target.value)}>
        <option value="">Все назначения</option>
        <option value="assigned">Назначен</option>
        <option value="unassigned">Без назначения</option>
      </select>
      <button aria-pressed={ascending} onClick={() => setAscending(!ascending)}><ArrowUpDown size={16} />По номеру</button>
      <button aria-pressed={onlyFavorites} onClick={() => setOnlyFavorites(!onlyFavorites)}><Star size={16} />Избранное</button>
    </div>
    <div className="crm-table-scroll"><table><thead><tr><th aria-label="Избранное" /><th aria-sort={ascending ? 'ascending' : 'descending'}>№</th><th>Тема обращения</th><th>Тип</th><th>Статус</th><th>Категория</th><th>Назначение</th><th aria-label="Открыть карточку" /></tr></thead>
      <tbody>{filtered.map(row => <tr key={row.id} className="crm-request-row" onClick={event => {
        if (!(event.target as Element).closest('a, button')) router.push(detailHref(row.id), { scroll: false })
      }}>
        <td><button className="crm-star" aria-label="В избранное" aria-pressed={favorites.includes(row.id)} onClick={() => setFavorites(previous => previous.includes(row.id) ? previous.filter(id => id !== row.id) : [...previous, row.id])}><Star size={15} fill={favorites.includes(row.id) ? 'currentColor' : 'none'} /></button></td>
        <td><Link className="case-ref" scroll={false} href={detailHref(row.id)}>{requestNumber(row)}</Link></td>
        <td>
          <Link className="case-row-title" scroll={false} href={detailHref(row.id)}>{row.title}</Link>
          {row.description && <p className="idea-row-description">{row.description}</p>}
          {row.next_step && <CaseNextStep>{row.next_step}</CaseNextStep>}
        </td>
        <td><CaseKind kind={row.kind} /></td>
        <td>
          <CaseStatus status={row.status} label={t(row.status)} />
          <small className="case-stage">{feedbackStages[feedbackStage(row)]}</small>
        </td>
        <td><CaseCategory name={categories[row.category_id] ?? row.category_id} /></td>
        <td><CaseAssignment assigned={Boolean(row.assignee_id)} closed={terminalStatuses.includes(row.status)} /></td>
        <td><ChevronRight className="case-chevron" size={16} aria-hidden="true" /></td>
      </tr>)}</tbody></table></div>
    {!filtered.length && <div className="crm-empty"><Inbox size={28} /><p>Обращений по выбранным условиям нет</p></div>}
    <footer className="crm-table-footer" aria-live="polite">Показано {filtered.length} из {rows.length}</footer>
  </section>
}
