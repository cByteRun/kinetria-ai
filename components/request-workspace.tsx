import Link from 'next/link'
import { notFound } from 'next/navigation'
import { CheckCheck, ClipboardList, Clock3, MessageCircle } from 'lucide-react'
import { aiConfig } from '../lib/ai'
import { getFormatter, getLocale, getTranslations } from 'next-intl/server'
import {
  updateRequest,
  saveRouting,
  saveCategory,
  dashboardAction,
} from '../app/workspace/actions'
import { isLocale } from '../i18n/settings'
import {
  feedbackStage,
  feedbackStages,
  sentimentLabel,
  terminalStatuses,
  topicTags,
  transitions,
  uuidPattern,
  type Category,
  type RequestStatus,
} from '../lib/requests'
import { canViewInsights, isRole } from '../lib/roles'
import { createClient } from '../lib/supabase/server'
import { IdeaOverview } from './idea-overview'
import { RequestForm } from './request-form'
import {
  RequestRegistry,
  StatusBadge,
  type RegistryRow,
} from './request-registry'
import { RequestSummary } from './request-summary'
import {
  CaseAssignment,
  CaseCategory,
  CaseKind,
  CaseStatus,
} from './case-labels'
import { DashboardViews, Heading } from './dashboard-views'
import { dateLabel, isDone } from '../lib/dashboard'
import { CaseReviewFields } from './case-review-fields'

type RequestRow = RegistryRow

type Assignee = { id: string; role: string; display_name: string | null }

function reference(request: RequestRow) {
  return request.source_ref ?? 'R-' + String(request.number).padStart(3, '0')
}

export async function RequestWorkspace({
  role,
  id,
  error,
  view = 'registry',
}: {
  role: 'employee' | 'manager' | 'handler' | 'admin'
  id?: string
  error?: string
  view?: string
}) {
  const t = await getTranslations('requestsMvp')
  const locale = await getLocale()
  const path = '/workspace/' + role
  if ((view === 'analytics' || view === 'insights') && !canViewInsights(role)) notFound()
  if (id && (typeof id !== 'string' || !uuidPattern.test(id))) notFound()
  const supabase = await createClient()
  const [list, categoryList] = await Promise.all([
    supabase
      .from('requests')
      .select(
        'id,number,source_ref,category_id,title,status,assignee_id,kind,sentiment,description,next_step,decision,updated_at,created_at,due_at,department,priority,first_response_at,resolved_at,acknowledged_at,is_demo,version,tags',
      )
      .order('updated_at', { ascending: false })
      .order('id')
      .returns<RequestRow[]>(),
    supabase
      .from('request_categories')
      .select('id,name_ru,name_en,name_kk,active,department,sla_days')
      .returns<
        (Category & { active: boolean; department: string; sla_days: number })[]
      >(),
  ])
  if (list.error || categoryList.error)
    return <p role="alert">{t('loadError')}</p>
  const categories = categoryList.data
    .map((category) => ({
      id: category.id,
      name: category[`name_${isLocale(locale) ? locale : 'ru'}`],
      active: category.active,
      department: category.department,
      days: category.sla_days,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, locale))
  const { data: routing } = await supabase.rpc('routing_preview')
  const managers =
    role === 'admin' ? await supabase.rpc('routing_managers') : null
  const routes = Object.fromEntries(
    (Array.isArray(routing) ? routing : []).map(
      (route: { category_id: string; recipient: string }) => [
        route.category_id,
        route.recipient,
      ],
    ),
  )
  const categoryNames = Object.fromEntries(
    categories.map((item) => [item.id, item.name]),
  )
  const { data: receiptRows } =
    view === 'notifications'
      ? await supabase
          .from('request_receipts')
          .select('request_id,seen_version')
      : { data: [] }
  const receipts = Object.fromEntries(
    (receiptRows || []).map((r) => [r.request_id, r.seen_version]),
  )
  if (id)
    return (
      <RequestDetail
        id={id}
        role={role}
        error={error}
        categoryNames={categoryNames}
      />
    )
  if (view === 'overview')
    return (
      <IdeaOverview
        rows={list.data}
        categories={categoryNames}
        role={role}
        path={path}
      />
    )
  if (['results', 'analytics', 'insights', 'notifications', 'help'].includes(view))
    return (
      <DashboardViews
        rows={list.data}
        categories={categoryNames}
        path={path}
        view={view}
        receipts={receipts}
      />
    )
  if (view === 'new' && role === 'employee')
    return (
      <>
        <Heading
          title="Расскажите, что можно улучшить."
          description="Вы описываете ситуацию. IdeaRoute помогает довести её до результата."
        />
        <RequestForm
          categories={categories.filter((c) => c.active)}
          aiEnabled={Boolean(aiConfig())}
          routes={routes}
        />
      </>
    )
  if ((view === 'routing' || view === 'categories') && role === 'admin')
    return (
      <>
        <Heading
          title={view === 'routing' ? 'Маршрутизация' : 'Категории'}
          description={
            view === 'routing'
              ? 'Категория → ответственный → срок. Без маршрута обращение попадёт в резервную очередь.'
              : 'Настройте темы обращений, подразделения и сроки рассмотрения.'
          }
        />
        {error && (
          <p role="alert" className="form-error">
            {t('saveError')}
          </p>
        )}
        {view === 'routing' && (
          <section className="card ir-section-gap">
            <div className="card-head">
              <div>
                <h2>Резервная очередь</h2>
                <p>Назначьте ответственного в карточке обращения.</p>
              </div>
            </div>
            <RequestRegistry
              showRecurrence={canViewInsights(role)}
              rows={list.data.filter((r) => !r.assignee_id && !isDone(r))}
              categories={categoryNames}
              path={path}
            />
          </section>
        )}
        <section className="card">
          <div className="card-head">
            <h2>
              {view === 'routing'
                ? 'Правила передачи обращений'
                : 'Категории обращений'}
            </h2>
          </div>
          <div className="table-scroll">
            <table className="case-table settings-table">
              <thead>
                <tr>
                  <th>Категория</th>
                  <th>{view === 'routing' ? 'Ответственный' : 'Настройки'}</th>
                </tr>
              </thead>
              <tbody>
                {categories.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <strong>{c.name}</strong>
                      <p className="case-caption">
                        {c.department} · {c.days} дн. ·{' '}
                        {c.active ? 'Активна' : 'Архив'}
                      </p>
                    </td>
                    <td>
                      {view === 'routing' ? (
                        <form action={saveRouting} className="ir-flex ir-wrap">
                          <input type="hidden" name="category" value={c.id} />
                          <span>{routes[c.id] || 'Резервная очередь'}</span>
                          <select
                            className="form-field"
                            style={{ width: 'auto' }}
                            name="manager"
                            aria-label={'Получатель: ' + c.name}
                            required
                            defaultValue=""
                          >
                            <option value="" disabled>
                              Выберите действие
                            </option>
                            <option value="disabled">
                              Отключить маршрут → резерв
                            </option>
                            {Array.isArray(managers?.data) &&
                              managers.data.map(
                                (m: { id: string; display_name: string }) => (
                                  <option key={m.id} value={m.id}>
                                    {m.display_name}
                                  </option>
                                ),
                              )}
                          </select>
                          <button className="btn sm">Сохранить маршрут</button>
                        </form>
                      ) : (
                        <details>
                          <summary>Изменить категорию</summary>
                          <CategoryForm category={c} />
                        </details>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        {view === 'categories' && (
          <section className="card help-section ir-section-gap">
            <h2>Новая категория</h2>
            <CategoryForm />
          </section>
        )}
      </>
    )
  return (
    <>
      <Heading
        title={role === 'employee' ? 'Мои обращения' : 'Реестр обращений'}
        description="Вся история, ответственные, сроки и результаты в одном месте."
      />
      <RequestRegistry
        showRecurrence={canViewInsights(role)}
        key={view}
        rows={list.data}
        categories={categoryNames}
        path={path}
      />
    </>
  )
}

function CategoryForm({
  category,
}: {
  category?: {
    id: string
    name: string
    department: string
    days: number
    active: boolean
  }
}) {
  return (
    <form action={saveCategory} className="ir-category-form">
      <input type="hidden" name="category" value={category?.id || ''} />
      <label>
        Название
        <input
          className="form-field"
          name="name"
          required
          minLength={3}
          maxLength={100}
          defaultValue={category?.name}
        />
      </label>
      <label>
        Подразделение
        <input
          className="form-field"
          name="department"
          required
          maxLength={100}
          defaultValue={category?.department || 'Операционные процессы'}
        />
      </label>
      <label>
        Срок, дней
        <input
          className="form-field"
          name="days"
          type="number"
          min={1}
          max={90}
          required
          defaultValue={category?.days || 3}
        />
      </label>
      <label className="ir-flex">
        <input
          name="active"
          type="checkbox"
          defaultChecked={category?.active ?? true}
        />
        Доступна в форме
      </label>
      <button className="btn primary">Сохранить категорию</button>
    </form>
  )
}

async function RequestDetail({
  id,
  role,
  error,
  categoryNames,
}: {
  id: string
  role: 'employee' | 'manager' | 'handler' | 'admin'
  error?: string
  categoryNames: Record<string, string>
}) {
  const t = await getTranslations('requestsMvp')
  const roleText = await getTranslations('roles')
  const format = await getFormatter()
  const supabase = await createClient()
  const [detail, history, assignees, materials, people] = await Promise.all([
    supabase
      .from('requests')
      .select(
        'id,number,source_ref,category_id,title,status,assignee_id,kind,sentiment,tags,description,proposal,decision,next_step,version,department,priority,due_at,created_at,updated_at,first_response_at,resolved_at,acknowledged_at,is_demo',
      )
      .eq('id', id)
      .returns<
        (RequestRow & {
          description: string
          proposal: string | null
          decision: string | null
          next_step: string | null
          version: number
          tags: string[]
        })[]
      >()
      .maybeSingle(),
    supabase
      .from('request_events')
      .select('id,actor_role,event_type,status,message,next_step,created_at')
      .eq('request_id', id)
      .order('id')
      .returns<
        {
          id: number
          actor_role: string
          event_type: string
          status: RequestStatus
          message: string | null
          next_step: string | null
          created_at: string
        }[]
      >(),
    role === 'admin'
      ? supabase.rpc('routing_managers')
      : role === 'manager'
        ? supabase.rpc('request_assignees')
        : null,
    supabase
      .from('request_attachments')
      .select('id,name,size')
      .eq('request_id', id),
    supabase.rpc('request_people', { p_id: id }),
  ])
  if (detail.error || history.error || people.error || materials.error)
    return <p role="alert">{t('loadError')}</p>
  const request = detail.data
  if (!request) notFound()
  const available = transitions[request.status]
  const stage = feedbackStage(request)
  const tags = topicTags(request.tags)
  const question =
    request.status === 'clarification'
      ? history.data.findLast(
          (event) =>
            event.event_type === 'reviewed' && event.status === 'clarification',
        )?.message
      : null
  const versionFields = (
    <>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="version" value={request.version} />
    </>
  )

  return (
    <>
      <Link
        href={'/workspace/' + role + '?view=registry'}
        className="btn ghost ir-section-gap"
      >
        ← Вернуться к обращениям
      </Link>
      {(error === 'conflict' ||
        error === 'invalid' ||
        error === 'saveError') && (
        <p role="alert" className="error">
          {t(error)}
        </p>
      )}
      <article className="workspace-panel request-panel crm-detail ir-detail">
        <header className="case-detail-heading">
          <span className="case-ref">{reference(request)}</span>
          <h2>{request.title}</h2>
          <div className="case-labels">
            <StatusBadge row={request} />
            <CaseKind kind={request.kind} />
            <CaseCategory
              name={categoryNames[request.category_id] ?? request.category_id}
            />
          </div>
          {request.is_demo && (
            <span className="tiny-pill">Демо · синтетическое обращение</span>
          )}
        </header>
        <div className="detail-route">
          {[
            'Получено',
            'Рассмотрение',
            'Уточнение',
            'Действия',
            'Результат',
          ].map((label, i) => (
            <div
              key={label}
              className={
                'detail-step ' +
                (i ===
                (['new', 'review', 'clarification', 'in_progress'].indexOf(
                  request.status,
                ) === -1
                  ? 4
                  : ['new', 'review', 'clarification', 'in_progress'].indexOf(
                      request.status,
                    ))
                  ? 'current'
                  : '')
              }
            >
              <CheckCheck size={14} />
              {label}
            </div>
          ))}
        </div>
        <div className="crm-detail-content">
          {!isDone(request) && (
            <section
              className={'case-current case-current-' + stage}
              aria-label="Состояние обращения"
            >
              <div className="case-labels">
                <CaseStatus status={request.status} label={t(request.status)} />
                <CaseAssignment
                  assigned={Boolean(request.assignee_id)}
                  closed={terminalStatuses.includes(request.status)}
                />
              </div>
              <strong>{feedbackStages[stage]}</strong>
            </section>
          )}
          {question && (
            <section className="case-section">
              <h3>
                <MessageCircle size={17} aria-hidden="true" />
                Запрос уточнения
              </h3>
              <p className="request-text">{question}</p>
            </section>
          )}
          {(request.decision || request.next_step) && (
            <section className="crm-outcome">
              {request.decision && (
                <>
                  <h3>
                    <CheckCheck size={18} aria-hidden="true" />
                    Решение для автора
                  </h3>
                  <p className="request-text">{request.decision}</p>
                </>
              )}
              {request.next_step && (
                <>
                  <h3>{t('nextStep')}</h3>
                  <p className="request-text">{request.next_step}</p>
                </>
              )}
            </section>
          )}
          <section className="case-section">
            <h3>
              <ClipboardList size={17} aria-hidden="true" />
              Исходное обращение
            </h3>
            <p className="request-text">{request.description}</p>
            {request.proposal && (
              <>
                <h4>{t('proposal')}</h4>
                <p className="request-text">{request.proposal}</p>
              </>
            )}
            {tags.length > 0 && (
              <ul className="crm-request-tags" aria-label="Темы обращения">
                {tags.map((tag) => (
                  <li key={tag}>{tag}</li>
                ))}
              </ul>
            )}
            {request.sentiment !== null && (
              <small>Тональность: {sentimentLabel(request.sentiment)}</small>
            )}
          </section>
          {materials.data && materials.data.length > 0 && (
            <section className="case-section">
              <h3>Материалы обращения</h3>
              <div className="attachments">
                {materials.data.map((f) => (
                  <a
                    className="attachment"
                    key={f.id}
                    href={'/api/attachments/' + f.id}
                  >
                    {f.name} · {Math.ceil(f.size / 1024)} КБ
                  </a>
                ))}
              </div>
            </section>
          )}
          {role === 'employee' &&
            terminalStatuses.includes(request.status) &&
            request.decision && (
              <section className="crm-outcome">
                {request.acknowledged_at ? (
                  <p>
                    <CheckCheck size={16} /> Вы ознакомились с результатом ·{' '}
                    {dateLabel(request.acknowledged_at)}
                  </p>
                ) : (
                  <form action={dashboardAction}>
                    {versionFields}
                    <input type="hidden" name="action" value="acknowledged" />
                    <button className="btn primary">
                      Ознакомился с результатом
                    </button>
                  </form>
                )}
              </section>
            )}
          {role !== 'employee' && aiConfig() && <RequestSummary id={id} />}
        </div>
        <aside className="crm-detail-actions">
          <h3>Ответственность и срок</h3>
          <dl className="ir-properties">
            <div>
              <dt>Ответственный</dt>
              <dd>{people.data?.[0]?.assignee_name || 'Резервная очередь'}</dd>
            </div>
            <div>
              <dt>Автор</dt>
              <dd>{people.data?.[0]?.author_name || 'Сотрудник'}</dd>
            </div>
            <div>
              <dt>Подразделение</dt>
              <dd>{request.department}</dd>
            </div>
            <div>
              <dt>Срок</dt>
              <dd>{dateLabel(request.due_at)}</dd>
            </div>
            <div>
              <dt>Приоритет</dt>
              <dd>
                {request.priority === 'high'
                  ? 'Высокий'
                  : request.priority === 'low'
                    ? 'Низкий'
                    : 'Обычный'}
              </dd>
            </div>
          </dl>

          {((role === 'employee' && request.status === 'clarification') ||
            ((role === 'manager' || role === 'handler') &&
              !isDone(request))) && (
            <h3>{role === 'employee' ? 'Нужен ваш ответ' : 'Рассмотрение'}</h3>
          )}
          {(role === 'manager' || role === 'handler') &&
            available.length > 0 && (
              <form action={updateRequest} className="request-fields">
                {versionFields}
                <input type="hidden" name="action" value="reviewed" />
                {request.status === 'new' ? (
                  <>
                    <input type="hidden" name="status" value="review" />
                    <button className="button button-primary">
                      Взять на рассмотрение
                    </button>
                  </>
                ) : (
                  <CaseReviewFields
                    key={request.version}
                    available={available}
                  />
                )}
              </form>
            )}
          {role === 'employee' && request.status === 'clarification' && (
            <form action={updateRequest} className="request-fields">
              {versionFields}
              <input type="hidden" name="action" value="replied" />
              <label>
                {t('reply')}
                <textarea name="message" rows={3} maxLength={2000} required />
              </label>
              <button className="button button-primary">
                {t('submitReply')}
              </button>
            </form>
          )}
          {role === 'manager' &&
            !terminalStatuses.includes(request.status) &&
            Array.isArray(assignees?.data) && (
              <form action={updateRequest} className="request-fields">
                {versionFields}
                <input type="hidden" name="action" value="assigned" />
                <label>
                  {t('assignee')}
                  <select
                    name="assignee"
                    defaultValue={request.assignee_id ?? ''}
                  >
                    <option value="">{t('unassigned')}</option>
                    {assignees.data.map((person: Assignee) => (
                      <option key={person.id} value={person.id}>
                        {person.display_name ||
                          (isRole(person.role)
                            ? roleText(person.role)
                            : person.role)}
                      </option>
                    ))}
                  </select>
                </label>
                <button className="button button-outline">
                  {t('saveAssignee')}
                </button>
              </form>
            )}
          {assignees?.error && <p role="alert">{t('loadError')}</p>}
          {role !== 'employee' &&
            !terminalStatuses.includes(request.status) && (
              <section className="card help-section ir-detail-metadata">
                <h3>Срок и приоритет</h3>
                <form action={dashboardAction} className="ir-flex ir-wrap">
                  {versionFields}
                  <input type="hidden" name="action" value="metadata" />
                  <label>
                    Срок
                    <input
                      className="form-field"
                      type="date"
                      name="due"
                      required
                      defaultValue={request.due_at?.slice(0, 10)}
                    />
                  </label>
                  <label>
                    Приоритет
                    <select
                      className="form-field"
                      name="priority"
                      defaultValue={request.priority || 'normal'}
                    >
                      <option value="low">Низкий</option>
                      <option value="normal">Обычный</option>
                      <option value="high">Высокий</option>
                    </select>
                  </label>
                  <button className="btn">Сохранить параметры</button>
                </form>
                {role === 'admin' && !request.assignee_id && (
                  <form
                    action={dashboardAction}
                    className="ir-flex ir-wrap ir-section-gap"
                  >
                    {versionFields}
                    <input type="hidden" name="action" value="assigned" />
                    <label>
                      Ответственный
                      <select className="form-field" name="assignee" required>
                        <option value="">Выберите руководителя</option>
                        {Array.isArray(assignees?.data) &&
                          assignees.data.map(
                            (m: { id: string; display_name: string }) => (
                              <option key={m.id} value={m.id}>
                                {m.display_name}
                              </option>
                            ),
                          )}
                      </select>
                    </label>
                    <button className="btn primary">
                      Назначить из резерва
                    </button>
                  </form>
                )}
              </section>
            )}
        </aside>
        <section className="crm-detail-history">
          <h3>
            <Clock3 size={17} aria-hidden="true" />
            {t('history')}
          </h3>
          <ol className="request-history">
            {history.data.map((event) => (
              <li key={event.id}>
                <strong>
                  {(
                    {
                      commented: 'Комментарий',
                      metadata: 'Параметры обновлены',
                      acknowledged: 'Автор ознакомился',
                    } as Record<string, string>
                  )[event.event_type] || t(event.event_type)}{' '}
                  · {t(event.status)}
                </strong>
                <small>
                  {isRole(event.actor_role)
                    ? roleText(event.actor_role) + ' · '
                    : ''}
                  {format.dateTime(new Date(event.created_at), {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                    timeZone: 'Asia/Qyzylorda',
                  })}
                </small>
                {event.message && (
                  <p className="request-text">{event.message}</p>
                )}
                {event.next_step && (
                  <p className="request-text">{event.next_step}</p>
                )}
              </li>
            ))}
          </ol>
          <form action={dashboardAction} className="request-fields comment-box">
            {versionFields}
            <input type="hidden" name="action" value="commented" />
            <label>
              Комментарий
              <textarea
                name="message"
                rows={3}
                maxLength={2000}
                required
                placeholder="Дополните обращение или обсудите следующий шаг"
              />
            </label>
            <button className="btn primary">Добавить комментарий</button>
          </form>
        </section>
      </article>
    </>
  )
}
