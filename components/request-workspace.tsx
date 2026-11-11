import { notFound } from 'next/navigation'
import Link from 'next/link'
import { aiConfig } from '../lib/ai'
import { getFormatter, getLocale, getTranslations } from 'next-intl/server'
import { updateRequest, saveRouting } from '../app/workspace/actions'
import { isLocale } from '../i18n/settings'
import { requestKindLabels, sentimentLabel, terminalStatuses, topicTags, transitions, uuidPattern, type Category, type RequestStatus } from '../lib/requests'
import { isRole } from '../lib/roles'
import { createClient } from '../lib/supabase/server'
import { RequestForm } from './request-form'
import { RequestRegistry, type RegistryRow } from './request-registry'
import { RequestSummary } from './request-summary'
import { RequestDrawer } from './request-drawer'

type RequestRow = RegistryRow

type Assignee = { id: string; role: string; display_name: string | null }

function reference(request: RequestRow) {
  return request.source_ref ?? 'R-' + String(request.number).padStart(3, '0')
}

export async function RequestWorkspace({ role, id, error, view = 'registry' }: {
  role: 'employee' | 'manager' | 'handler' | 'admin'
  id?: string
  error?: string
  view?: string
}) {
  const t = await getTranslations('requestsMvp')
  const locale = await getLocale()
  const path = '/workspace/' + role
  if (id && (typeof id !== 'string' || !uuidPattern.test(id))) notFound()
  const supabase = await createClient()
  const [list, categoryList] = await Promise.all([
    supabase.from('requests').select('id,number,source_ref,category_id,title,status,assignee_id,kind,sentiment')
      .order('updated_at', { ascending: false }).order('id').returns<RequestRow[]>(),
    supabase.from('request_categories').select('id,name_ru,name_en,name_kk,active')
      .returns<(Category & { active: boolean })[]>(),
  ])
  if (list.error || categoryList.error) return <p role="alert">{t('loadError')}</p>
  const categories = categoryList.data.map(category => ({
    id: category.id,
    name: category[`name_${isLocale(locale) ? locale : 'ru'}`],
    active: category.active,
  })).sort((a, b) => a.name.localeCompare(b.name, locale))
  const categoryName = (category: string) => categories.find(item => item.id === category)?.name ?? category
  const { data: routing } = await supabase.rpc('routing_preview')
  const managers = role === 'admin' ? await supabase.rpc('routing_managers') : null
  const routes = Object.fromEntries((Array.isArray(routing) ? routing : []).map((route: { category_id: string; recipient: string }) => [route.category_id, route.recipient]))
  const selected = id && <RequestDetail id={id} role={role} error={error}
    categoryNames={Object.fromEntries(categories.map(item => [item.id, item.name]))} />
  return (
    <>
      <h1>{view === 'overview' && !id ? 'Обзор обращений' : t(role === 'employee' ? 'mine' : role === 'handler' ? 'assignedQueue' : 'queue')}</h1>
      {!id && role === 'employee' && view === 'new' && <section>
        <RequestForm categories={categories.filter(category => category.active)}
          aiEnabled={Boolean(aiConfig())} routes={routes} />
      </section>}
      {(id || view !== 'new') && <>
        <div className="crm-metrics">{[
          ['Всего обращений', list.data.length],
          ['Ожидают рассмотрения', list.data.filter(item => item.status === 'new').length],
          ['В работе', list.data.filter(item => ['review', 'in_progress', 'clarification'].includes(item.status)).length],
          ['Реализовано', list.data.filter(item => item.status === 'implemented').length],
        ].map(([label, value]) => <div className="crm-metric" key={label}><span>{label}</span><strong>{value}</strong></div>)}</div>
        {view === 'overview' && !id ? <section className="workspace-panel request-panel">
          <h2>Последние обновления</h2>
          {list.data.length ? <ul>{list.data.slice(0, 5).map(item => <li key={item.id}>
            <Link href={path + '?view=registry&id=' + item.id}>{reference(item)} · {item.title}</Link> — {t(item.status)}
          </li>)}</ul> : <p>В вашей очереди пока нет обращений.</p>}
          <Link className="button button-outline" href={path + '?view=registry'}>Открыть реестр обращений</Link>
        </section> : view === 'routing' || view === 'categories' ? <section className="crm-registry">
          {error && <p role="alert">{t('saveError')}</p>}
          <table><thead><tr><th>Категория</th><th>Получатель</th>{view === 'routing' && <th>Изменить маршрут</th>}</tr></thead><tbody>{categories.map(category => <tr key={category.id}><td>{category.name}</td><td>{routes[category.id] || 'Резервная очередь'}</td>{view === 'routing' && <td><form action={saveRouting}>
            <input type="hidden" name="category" value={category.id} />
            <select name="manager" aria-label={'Руководитель для ' + category.name} required defaultValue=""><option value="" disabled>Выберите руководителя</option>{Array.isArray(managers?.data) && managers.data.map((manager: {id: string; display_name: string}) => <option key={manager.id} value={manager.id}>{manager.display_name}</option>)}</select>
            <button className="button button-outline">Сохранить</button>
          </form></td>}</tr>)}</tbody></table></section> :
          <RequestRegistry rows={list.data} categories={Object.fromEntries(categories.map(item => [item.id, item.name]))} path={path} />}
      </>}
      {selected && <RequestDrawer closeHref={path + '?view=registry'}>{selected}</RequestDrawer>}
    </>
  )
}

async function RequestDetail({ id, role, error, categoryNames }: {
  id: string
  role: 'employee' | 'manager' | 'handler' | 'admin'
  error?: string
  categoryNames: Record<string, string>
}) {
  const t = await getTranslations('requestsMvp')
  const roleText = await getTranslations('roles')
  const format = await getFormatter()
  const supabase = await createClient()
  const [detail, history, assignees] = await Promise.all([
    supabase.from('requests').select('id,number,source_ref,category_id,title,status,assignee_id,kind,sentiment,tags,description,proposal,decision,next_step,version')
      .eq('id', id).returns<(RequestRow & {
        description: string; proposal: string | null; decision: string | null;
        next_step: string | null; version: number; tags: string[]
      })[]>().maybeSingle(),
    supabase.from('request_events').select('id,actor_role,event_type,status,message,next_step,created_at')
      .eq('request_id', id).order('id').returns<{
        id: number; actor_role: string; event_type: 'created' | 'assigned' | 'reviewed' | 'replied';
        status: RequestStatus; message: string | null; next_step: string | null; created_at: string
      }[]>(),
    role === 'manager'
      ? supabase.rpc('request_assignees')
      : null,
  ])
  if (detail.error || history.error) return <p role="alert">{t('loadError')}</p>
  const request = detail.data
  if (!request) notFound()
  const available = transitions[request.status]
  const versionFields = <>
    <input type="hidden" name="id" value={id} />
    <input type="hidden" name="version" value={request.version} />
  </>

  return (
    <article className="workspace-panel request-panel crm-detail">
      <div className="crm-detail-content">
      <p>{reference(request)} · {categoryNames[request.category_id]}</p>
      <h2>{request.title}</h2>
      <p>{requestKindLabels[request.kind]} · {sentimentLabel(request.sentiment)}</p>
      <h3>Теги</h3>
      <ul className="crm-request-tags">
        <li>{requestKindLabels[request.kind]}</li>
        {topicTags(request.tags).map(tag => <li key={tag}>{tag}</li>)}
      </ul>
      <p><strong>{t(request.status)}</strong> · {t(request.assignee_id ? 'hasAssignee' : 'unassigned')}</p>
      <p className="request-text">{request.description}</p>
      {role !== 'employee' && aiConfig() && <RequestSummary id={id} />}
      {request.proposal && <><h3>{t('proposal')}</h3><p className="request-text">{request.proposal}</p></>}
      {request.decision && <><h3>{t('decision')}</h3><p className="request-text">{request.decision}</p></>}
      {request.next_step && <><h3>{t('nextStep')}</h3><p className="request-text">{request.next_step}</p></>}
      <h3>{t('history')}</h3>
      <ol className="request-history">
        {history.data.map(event => <li key={event.id}>
          <strong>{t(event.event_type)} · {t(event.status)}</strong>
          <small>{format.dateTime(new Date(event.created_at), { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Qyzylorda' })}</small>
          {event.message && <p className="request-text">{event.message}</p>}
          {event.next_step && <p className="request-text">{event.next_step}</p>}
        </li>)}
      </ol>
      </div><aside className="crm-detail-actions"><h3>Рассмотрение</h3>
      {(error === 'conflict' || error === 'invalid' || error === 'saveError') &&
        <p role="alert" className="error">{t(error)}</p>}
      {(role === 'manager' || role === 'handler') && available.length > 0 && <form action={updateRequest} className="request-fields">
        {versionFields}
        <input type="hidden" name="action" value="reviewed" />
        <label>{t('nextStatus')}<select name="status" required>
          {available.map(status => <option key={status} value={status}>{t(status)}</option>)}
        </select></label>
        <label>{t('message')}<textarea name="message" rows={3} maxLength={2000} /></label>
        <label>{t('nextStep')}<input name="nextStep" maxLength={1000} /></label>
        <p className="muted">{t('reviewHint')}</p>
        <button className="button button-primary">{t('save')}</button>
      </form>}
      {role === 'employee' && request.status === 'clarification' &&
        <form action={updateRequest} className="request-fields">
          {versionFields}
          <input type="hidden" name="action" value="replied" />
          <label>{t('reply')}<textarea name="message" rows={3} maxLength={2000} required /></label>
          <button className="button button-primary">{t('submitReply')}</button>
        </form>}
      {role === 'manager' && !terminalStatuses.includes(request.status) && Array.isArray(assignees?.data) &&
        <form action={updateRequest} className="request-fields">
          {versionFields}
          <input type="hidden" name="action" value="assigned" />
          <label>{t('assignee')}<select name="assignee" defaultValue={request.assignee_id ?? ''}>
            <option value="">{t('unassigned')}</option>
            {assignees.data.map((person: Assignee) => <option key={person.id} value={person.id}>
              {person.display_name || (isRole(person.role) ? roleText(person.role) : person.role)}
            </option>)}
          </select></label>
          <button className="button button-outline">{t('saveAssignee')}</button>
        </form>}
      {assignees?.error && <p role="alert">{t('loadError')}</p>}
      {role === 'employee' && request.status !== 'clarification' && <p className="muted">Статус и решение обновляются после рассмотрения обращения.</p>}
      </aside>
    </article>
  )
}
