'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { ArrowUpRight, CheckCheck, Inbox, Lightbulb, MessageCircle, ShieldCheck, Activity } from 'lucide-react'
import { terminalStatuses, statuses } from '../lib/requests'
import { RequestRegistry, type RegistryRow } from './request-registry'

export function IdeaOverview({ rows, categories, role, path }: {
  rows: RegistryRow[]; categories: Record<string, string>; role: string; path: string
}) {
  const t = useTranslations('requestsMvp')
  const [category, setCategory] = useState('')
  const [status, setStatus] = useState('')
  const employee = role === 'employee'
  const open = rows.filter(row => !terminalStatuses.includes(row.status))
  const attention = open.filter(row => employee ? row.status === 'clarification' : role === 'admin' ? !row.assignee_id : role === 'handler' ? row.status !== 'clarification' : row.status === 'new' || row.status === 'review')
  const completed = rows.filter(row => terminalStatuses.includes(row.status))
  const results = completed.filter(row => row.decision?.trim())
  const percent = (n: number) => rows.length ? Math.round(n / rows.length * 100) + '%' : '—'
  const counts = Object.entries(categories).map(([id, name]) => ({ id, name, count: rows.filter(row => row.category_id === id).length })).filter(item => item.count).sort((a, b) => b.count - a.count)
  const visible = rows.filter(row => (!category || row.category_id === category) && (!status || row.status === status))
  const titles: Record<string, string> = { employee: 'Мои обращения', manager: 'Обращения направления', handler: 'Назначенные мне', admin: 'Контроль обращений' }
  return <>
    <section className="idea-hero idea-dot-field"><div><p className="idea-eyebrow">ГК «Модус Трейд»</p><h1>{titles[role]}</h1><p>{employee ? 'Подайте предложение или сообщите о проблеме. Здесь видны статус и ответ.' : 'Следите за очередью, ответственными и итогами рассмотрения.'}</p></div><Link className="button button-primary" href={path + (employee ? '?view=new' : '?view=registry')}>{employee ? 'Подать обращение' : 'Открыть рабочую очередь'}<ArrowUpRight size={17} /></Link></section>
    <p className="idea-scope"><ShieldCheck size={14} />{employee ? 'Только ваши обращения' : role === 'manager' ? 'Обращения вашего направления' : role === 'handler' ? 'Только назначенные вам обращения' : 'Все внутренние обращения'} · за всё время</p>
    <div className="crm-metrics idea-metrics">{[
      { label: 'Всего обращений', value: rows.length, hint: 'В вашей области доступа', icon: Inbox },
      { label: 'Рассмотрение завершено', value: percent(completed.length), hint: `${completed.length} из ${rows.length} обращений`, icon: CheckCheck },
      { label: 'Зафиксирован результат', value: percent(results.length), hint: 'Завершены и содержат решение', icon: MessageCircle },
      { label: 'Реализовано улучшений', value: rows.filter(row => row.status === 'implemented').length, hint: 'Со статусом «Реализовано»', icon: Lightbulb },
    ].map(item => <div className="crm-metric" key={item.label}><div className="idea-metric-label"><span>{item.label}</span><item.icon size={18} /></div><strong>{item.value}</strong><small>{item.hint}</small></div>)}</div>
    <div className="idea-grid"><section className="idea-panel"><header><div><p className="idea-eyebrow">СЛЕДУЮЩИЙ ШАГ</p><h2>{employee ? 'Нужен ваш ответ' : role === 'admin' ? 'Без ответственного' : role === 'handler' ? 'Мои текущие задачи' : 'Требуют рассмотрения'}</h2></div><span className="idea-count">{attention.length}</span></header>
      {attention.length ? attention.slice(0, 4).map(row => <Link className="idea-action-row" key={row.id} href={path + '?view=registry&id=' + row.id}><span className="idea-row-icon"><MessageCircle size={18} /></span><div><small>{row.source_ref || `R-${row.number}`} · {categories[row.category_id]}</small><strong>{row.title}</strong><p>{row.next_step || (employee ? 'Откройте карточку и ответьте на запрос уточнения' : role === 'admin' ? 'Проверьте правило маршрутизации категории' : 'Зафиксируйте решение или следующий шаг')}</p></div><ArrowUpRight size={17} /></Link>) : <div className="idea-calm"><CheckCheck size={28} /><h3>Очередь внимания пуста</h3><p>Все доступные обращения остаются в реестре ниже.</p></div>}
      {role === 'admin' && <Link className="idea-text-link" href={path + '?view=routing'}>Настроить маршрутизацию →</Link>}
    </section><section className="idea-panel"><header><div><p className="idea-eyebrow">ПРОЗРАЧНЫЙ ПРОЦЕСС</p><h2>Где находятся обращения</h2></div><Activity size={19} /></header><div className="idea-stage-list">{statuses.map(s => { const count = rows.filter(row => row.status === s).length; return <button aria-pressed={status === s} key={s} onClick={() => setStatus(status === s ? '' : s)}><span>{t(s)}</span><strong>{count}</strong><span className="idea-track"><i style={{ width: `${rows.length ? count / rows.length * 100 : 0}%` }} /></span></button> })}</div><small>Нажмите на этап, чтобы отфильтровать реестр.</small></section></div>
    <div className="idea-grid idea-insights"><section className="idea-panel"><header><div><p className="idea-eyebrow">ТЕМЫ ОБРАЩЕНИЙ</p><h2>Точки улучшения</h2></div><Lightbulb size={19} /></header><p className="muted">Частота категорий помогает найти темы для проверки. Совпадение категории ещё не означает дубликат.</p><div className="idea-category-list">{counts.slice(0, 6).map(item => <button key={item.id} aria-pressed={category === item.id} onClick={() => setCategory(category === item.id ? '' : item.id)}><span>{item.name}</span><strong>{item.count}</strong></button>)}{!counts.length && <p className="muted">Темы появятся после первого обращения.</p>}</div></section><section className="idea-panel"><header><div><p className="idea-eyebrow">ОБРАТНАЯ СВЯЗЬ</p><h2>Последние результаты</h2></div><CheckCheck size={19} /></header>{results.slice(0, 3).map(row => <Link className="idea-result" key={row.id} href={path + '?view=registry&id=' + row.id}><span className={'crm-status status-' + row.status}>{t(row.status)}</span><strong>{row.title}</strong><p>{row.decision}</p></Link>)}{!results.length && <div className="idea-calm"><p>Здесь появятся завершённые обращения с зафиксированным решением.</p></div>}</section></div>
    <div className="idea-registry-heading"><div><p className="idea-eyebrow">ЕДИНЫЙ РЕЕСТР</p><h2>{employee ? 'Мои обращения' : 'Обращения в работе и история'}</h2></div>{(category || status) && <button className="button button-outline" onClick={() => { setCategory(''); setStatus('') }}>Сбросить: {[categories[category], status && t(status)].filter(Boolean).join(' · ')}</button>}</div>
    <RequestRegistry rows={visible} categories={categories} path={path} />
  </>
}
