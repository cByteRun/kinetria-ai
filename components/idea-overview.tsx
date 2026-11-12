'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { ArrowUpRight, CheckCheck, Inbox, Lightbulb, MessageCircle, ShieldCheck, Activity } from 'lucide-react'
import { feedbackStage, feedbackStages, terminalStatuses } from '../lib/requests'
import { RequestRegistry, type RegistryRow } from './request-registry'

export function IdeaOverview({ rows, categories, role, path }: {
  rows: RegistryRow[]; categories: Record<string, string>; role: string; path: string
}) {
  const t = useTranslations('requestsMvp')
  const [category, setCategory] = useState('')
  const [stage, setStage] = useState<keyof typeof feedbackStages | ''>('')
  const employee = role === 'employee'
  const open = rows.filter(row => !terminalStatuses.includes(row.status))
  const stageCounts = { routing: 0, withOwner: 0, awaitingAuthor: 0, missingOutcome: 0, resolved: 0 }
  for (const row of rows) stageCounts[feedbackStage(row)] += 1

  const focus = employee ? 'awaitingAuthor' : role === 'admin' ? 'routing' : 'withOwner'
  const attention = rows.filter(row => feedbackStage(row) === focus)
  const results = rows.filter(row => feedbackStage(row) === 'resolved')
  const completionRate = rows.length ? Math.round(results.length / rows.length * 100) + '%' : '—'
  const counts = Object.entries(categories).map(([id, name]) => ({ id, name, count: rows.filter(row => row.category_id === id).length })).filter(item => item.count).sort((a, b) => b.count - a.count)
  const visible = rows.filter(row => (!category || row.category_id === category) && (!stage || feedbackStage(row) === stage))
  const titles: Record<string, string> = { employee: 'Мои обращения', manager: 'Обращения направления', handler: 'Назначенные мне', admin: 'Контроль обращений' }
  return <>
    <section className="idea-hero idea-dot-field"><div><p className="idea-eyebrow">ГК «Модус Трейд»</p><h1>{titles[role]}</h1><p>{employee ? 'Подайте предложение или сообщите о проблеме. Здесь видны статус и ответ.' : 'Проверяйте, кто должен действовать дальше и где ещё нужен ответ автору.'}</p></div><Link className="button button-primary" href={path + (employee ? '?view=new' : '?view=registry')}>{employee ? 'Подать обращение' : 'Открыть рабочую очередь'}<ArrowUpRight size={17} /></Link></section>
    <p className="idea-scope"><ShieldCheck size={14} />{employee ? 'Только ваши обращения' : role === 'manager' ? 'Обращения вашего направления' : role === 'handler' ? 'Только назначенные вам обращения' : 'Все внутренние обращения'} · за всё время</p>
    <div className="crm-metrics idea-metrics">{[
      { label: 'Цикл завершён', value: completionRate, hint: `${results.length} из ${rows.length} с решением для автора`, icon: CheckCheck },
      { label: 'Открытые обращения', value: open.length, hint: 'Назначение, рассмотрение или уточнение', icon: Inbox },
      { label: 'Ждут ответа автора', value: stageCounts.awaitingAuthor, hint: 'Запрошено уточнение', icon: MessageCircle },
      { label: 'Закрыты без решения', value: stageCounts.missingOutcome, hint: 'Итоговый статус без записи результата', icon: Activity },
    ].map(item => <div className="crm-metric" key={item.label}><div className="idea-metric-label"><span>{item.label}</span><item.icon size={18} /></div><strong>{item.value}</strong><small>{item.hint}</small></div>)}</div>
    <div className="idea-grid"><section className="idea-panel"><header><div><p className="idea-eyebrow">СЛЕДУЮЩИЙ ШАГ</p><h2>{employee ? 'Нужен ваш ответ' : role === 'admin' ? 'Без ответственного' : role === 'handler' ? 'Мои текущие задачи' : 'Требуют действия ответственного'}</h2></div><span className="idea-count">{attention.length}</span></header>
      {attention.length ? attention.slice(0, 4).map(row => <Link className="idea-action-row" key={row.id} href={path + '?view=registry&id=' + row.id}><span className="idea-row-icon"><MessageCircle size={18} /></span><div><small>{row.source_ref || `R-${row.number}`} · {categories[row.category_id]}</small><strong>{row.title}</strong><p>{row.next_step || (employee ? 'Откройте карточку и ответьте на запрос уточнения' : role === 'admin' ? 'Проверьте правило маршрутизации категории' : 'Зафиксируйте решение или следующий шаг')}</p></div><ArrowUpRight size={17} /></Link>) : <div className="idea-calm"><CheckCheck size={28} /><h3>Очередь внимания пуста</h3><p>Все доступные обращения остаются в реестре ниже.</p></div>}
      {role === 'admin' && <Link className="idea-text-link" href={path + '?view=routing'}>Настроить маршрутизацию →</Link>}
    </section>
    <section className="idea-panel">
      <header><h2>Где нужен следующий шаг</h2><Activity size={19} /></header>
      <div className="idea-stage-list">
        {(Object.keys(feedbackStages) as (keyof typeof feedbackStages)[]).map(key => (
          <button key={key} aria-pressed={stage === key} aria-controls="feedback-registry"
            onClick={() => setStage(stage === key ? '' : key)}>
            <span>{feedbackStages[key]}</span><strong>{stageCounts[key]}</strong>
            <span className="idea-track"><i style={{ width: `${rows.length ? stageCounts[key] / rows.length * 100 : 0}%` }} /></span>
          </button>
        ))}
      </div>
      <a href="#feedback-registry" className="idea-text-link">Перейти к реестру ↓</a>
    </section></div>
    <div className="idea-grid idea-insights"><section className="idea-panel"><header><div><p className="idea-eyebrow">ТЕМЫ ОБРАЩЕНИЙ</p><h2>Точки улучшения</h2></div><Lightbulb size={19} /></header><p className="muted">Частота категорий помогает найти темы для проверки. Совпадение категории ещё не означает дубликат.</p><div className="idea-category-list">{counts.slice(0, 6).map(item => <button key={item.id} aria-pressed={category === item.id} onClick={() => setCategory(category === item.id ? '' : item.id)}><span>{item.name}</span><strong>{item.count}</strong></button>)}{!counts.length && <p className="muted">Темы появятся после первого обращения.</p>}</div></section><section className="idea-panel"><header><div><p className="idea-eyebrow">ОБРАТНАЯ СВЯЗЬ</p><h2>Решения для авторов</h2></div><CheckCheck size={19} /></header>{results.slice(0, 3).map(row => <Link className="idea-result" key={row.id} href={path + '?view=registry&id=' + row.id}><span className={'crm-status status-' + row.status}>{t(row.status)}</span><strong>{row.title}</strong><p>{row.decision}</p></Link>)}{!results.length && <div className="idea-calm"><p>Здесь появятся завершённые обращения с зафиксированным решением.</p></div>}</section></div>
    <div id="feedback-registry" className="idea-registry-heading"><div><p className="idea-eyebrow">ЕДИНЫЙ РЕЕСТР</p><h2>{employee ? 'Мои обращения' : 'Обращения в работе и история'}</h2></div>{(category || stage) && <button className="button button-outline" onClick={() => { setCategory(''); setStage('') }}>Сбросить: {[categories[category], stage && feedbackStages[stage]].filter(Boolean).join(' · ')}</button>}</div>
    <RequestRegistry rows={visible} categories={categories} path={path} />
  </>
}
