import { RequestDrawer } from './request-drawer'
import { readRegistry } from '../lib/registry-data'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { TelegramLink } from './telegram-link'
import { notFound } from 'next/navigation'
import {
  CheckCheck,
  Circle,
  ClipboardList,
  Clock3,
  MessageCircle,
} from 'lucide-react'
import { aiConfig } from '../lib/ai'
import { getFormatter, getLocale, getTranslations } from 'next-intl/server'
import {
  updateRequest,
  saveRouting,
  saveCategory,
  dashboardAction,
} from '../app/workspace/actions'
import { locales, isLocale } from '../i18n/settings'
import {
  requestProgressIndex,
  feedbackStage,
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
import { ImpactCard } from './impact-card'
import type { ImpactReport } from '../lib/impact-estimator'
import { RequestSummary } from './request-summary'
import {
  CaseAssignment,
  CaseCategory,
  CaseKind,
  CaseStatus,
} from './case-labels'
import { DashboardViews, Heading } from './dashboard-views'
import { dateLabel, isDone, isOverdue } from '../lib/dashboard'
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
  const [ui, t, locale] = await Promise.all([
    getTranslations('ui'), getTranslations('requestsMvp'), getLocale(),
  ])
  const path = '/workspace/' + role
  if ((view === 'analytics' || view === 'insights') && !canViewInsights(role))
    notFound()
  if (id && (typeof id !== 'string' || !uuidPattern.test(id))) notFound()
  const supabase = await createClient()
  const [list, categoryList, { data: routing }, managers, { data: receiptRows }] = await Promise.all([
    id || view === 'new' || view === 'help'
      ? { data: [] as RequestRow[], error: null }
      : readRegistry(supabase),
    supabase
      .from('request_categories')
      .select('id,name_ru,name_en,name_kk,active,department,sla_days')
      .returns<
        (Category & { active: boolean; department: string; sla_days: number })[]
      >(),
    view === 'new' || view === 'routing'
      ? supabase.rpc('routing_preview')
      : { data: [] },
    role === 'admin' && view === 'routing'
      ? supabase.rpc('routing_managers')
      : null,
    view === 'notifications'
      ? supabase.from('request_receipts').select('request_id,seen_version')
      : { data: [] },
  ])
  if (list.error || categoryList.error)
    return <p role="alert">{t('loadError')}</p>
  const categories = categoryList.data
    .map((category) => ({
      id: category.id,
      name_ru: category.name_ru,
      name_en: category.name_en,
      name_kk: category.name_kk,
      name: category[`name_${isLocale(locale) ? locale : 'ru'}`],
      active: category.active,
      department: category.department,
      days: category.sla_days,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, locale))
  const routes = Object.fromEntries(
    (Array.isArray(routing) ? routing : []).map(
      (route: { category_id: string; recipient: string }) => [
        route.category_id,
        route.recipient === 'Резервная очередь · администратор'
          ? ui('fallbackQueue')
          : route.recipient === 'Руководитель направления'
            ? ui('chooseAManager')
            : route.recipient === 'Ответственный специалист'
              ? ui('owner')
              : route.recipient,
      ],
    ),
  )
  const categoryNames = Object.fromEntries(
    categories.map((item) => [item.id, item.name]),
  )
  const receipts = Object.fromEntries(
    (receiptRows || []).map((r) => [r.request_id, r.seen_version]),
  )
  if (id)
    return <>
      <RequestRegistry canAskQvin={role === 'admin' || role === 'manager'} showRecurrence={canViewInsights(role)} rows={list.data} categories={categoryNames} path={path}/>
      <RequestDrawer closeHref={path + '?view=registry'}>
        <RequestDetail id={id} role={role} error={error} categoryNames={categoryNames}/>
      </RequestDrawer>
    </>
  if (view === 'overview')
    return (
      <IdeaOverview
        rows={list.data}
        categories={categoryNames}
        role={role}
        path={path}
      />
    )
  if (
    ['results', 'analytics', 'insights', 'notifications', 'help'].includes(view)
  )
    return (
      <>
      {view === 'help' && <TelegramLink />}
      <DashboardViews
        rows={list.data}
        categories={categoryNames}
        path={path}
        view={view}
        receipts={receipts}
      />
      </>
    )
  if (view === 'new' && role === 'employee')
    return (
      <>
        <Heading
          title={ui('tellUsWhatCouldBeImproved')}
          description={ui('youDescribeTheSituationIdearouteHelpsBringIt')}
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
          title={view === 'routing' ? ui('routing') : ui('categories')}
          description={
            view === 'routing'
              ? ui('categoryOwnerDeadlineWithoutARouteTheRequest')
              : ui('configureRequestTopicsDepartmentsAndReviewDeadlines')
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
                <h2>{ui('fallbackQueue')}</h2>
                <p>{ui('assignAnOwnerInTheRequestCard')}</p>
              </div>
            </div>
            <RequestRegistry
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
                ? ui('requestRoutingRules')
                : ui('requestCategories')}
            </h2>
          </div>
          <div className="table-scroll">
            <table className="case-table settings-table">
              <thead>
                <tr>
                  <th>{ui('category')}</th>
                  <th>{view === 'routing' ? ui('owner') : ui('settings')}</th>
                </tr>
              </thead>
              <tbody>
                {categories.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <strong>{c.name}</strong>
                      <p className="case-caption">
                        {c.department} · {c.days} {ui('days2')}{' '}
                        {c.active ? ui('active') : ui('archived')}
                      </p>
                    </td>
                    <td>
                      {view === 'routing' ? (
                        <form action={saveRouting} className="ir-flex ir-wrap">
                          <input type="hidden" name="category" value={c.id} />
                          <span>{routes[c.id] || ui('fallbackQueue')}</span>
                          <select
                            className="form-field"
                            style={{ width: 'auto' }}
                            name="manager"
                            aria-label={ui('recipient') + c.name}
                            required
                            defaultValue=""
                          >
                            <option value="" disabled>
                              {ui('chooseAnAction')}
                            </option>
                            <option value="disabled">
                              {ui('disableRouteFallbackQueue')}
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
                          <button className="btn sm">{ui('saveRoute')}</button>
                        </form>
                      ) : (
                        <div className="category-controls">
                          <CategoryForm category={c} />
                        </div>
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
            <h2>{ui('newCategory')}</h2>
            <CategoryForm />
          </section>
        )}
      </>
    )
  return (
    <>
      <RequestRegistry canAskQvin={role === 'admin' || role === 'manager'}
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
    name_ru: string
    name_en: string
    name_kk: string
    department: string
    days: number
    active: boolean
  }
}) {
  const ui = useTranslations('ui')

  return (
    <form action={saveCategory} className="ir-category-form">
      <input type="hidden" name="category" value={category?.id || ''} />
      {locales.map((language) => (
        <label key={language}>
          {ui('localeName', {
            language: ui(
              language === 'ru'
                ? 'languageRu'
                : language === 'en'
                  ? 'languageEn'
                  : 'languageKk',
            ),
          })}
          <input
            className="form-field"
            name={'name_' + language}
            lang={language}
            required
            minLength={3}
            maxLength={100}
            defaultValue={category?.[`name_${language}`]}
          />
        </label>
      ))}
      <label>
        {ui('department')}
        <input
          className="form-field"
          name="department"
          required
          maxLength={100}
          defaultValue={category?.department || ui('operationalProcesses')}
        />
      </label>
      <label>
        {ui('deadlineDays')}
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
        {ui('availableInTheForm')}
      </label>
      <button className="btn primary">{ui('saveCategory')}</button>
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
  const locale = await getLocale()

  const ui = await getTranslations('ui')

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
        {ui('backToRequests')}
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
          <h1>{request.title}</h1>
          <div className="case-labels">
            <StatusBadge row={request} />
            <CaseKind kind={request.kind} />
            <CaseCategory
              name={categoryNames[request.category_id] ?? request.category_id}
            />
          </div>
          {request.is_demo && (
            <span className="tiny-pill">{ui('demoSyntheticRequest')}</span>
          )}
          <div className="mobile-case-metadata">
            <span className="badge">{ui('owner')}: {(people.data?.[0]?.assignee_name === 'Резервная очередь' ? null : people.data?.[0]?.assignee_name) || ui('fallbackQueue')}</span>
            <span className="badge">{ui('reviewDeadline')}: {dateLabel(request.due_at, locale, ui('notSet'))}</span>
          </div>
        </header>
        <div className="detail-route" aria-label={ui('reviewStages')}>
          {[
            ['new', ui('received')],
            ['review', ui('review')],
            ['clarification', ui('clarification')],
            ['in_progress', ui('actions2')],
            ['result', ui('result')],
          ].map(([status, label], index) => {
            const current =
              status === 'result' ? isDone(request) : request.status === status
            const currentIndex = requestProgressIndex(request.status)
            const completed = index < currentIndex
            const Icon = completed ? CheckCheck : current ? Clock3 : Circle
            return (
              <div
                key={status}
                className={
                  'detail-step ' +
                  (current ? 'current' : completed ? 'done' : '')
                }
                aria-current={current ? 'step' : undefined}
              >
                <Icon size={14} aria-hidden="true" />
                {label}
              </div>
            )
          })}
        </div>
        <div className="crm-detail-content">
          {!isDone(request) && (
            <section
              className={'case-current case-current-' + stage}
              aria-label={ui('requestState')}
            >
              <div className="case-labels">
                <CaseStatus status={request.status} label={t(request.status)} />
                <CaseAssignment
                  assigned={Boolean(request.assignee_id)}
                  closed={terminalStatuses.includes(request.status)}
                />
              </div>
              <strong>
                {ui(
                  (
                    {
                      routing: 'routingStage',
                      withOwner: 'withOwnerStage',
                      awaitingAuthor: 'awaitingAuthorStage',
                      missingOutcome: 'missingOutcomeStage',
                      resolved: 'resolvedStage',
                    } as const
                  )[stage],
                )}
              </strong>
            </section>
          )}
          {question && (
            <section className="case-section">
              <h3>
                <MessageCircle size={17} aria-hidden="true" />
                {ui('clarificationRequest')}
              </h3>
              <p className="request-text">{question}</p>
            </section>
          )}
          {(request.decision || request.next_step) && (
            <section
              className={
                'crm-outcome ' +
                (isDone(request) ? 'is-result' : 'is-next-step')
              }
            >
              {request.decision && (
                <>
                  <h3>
                    <CheckCheck size={18} aria-hidden="true" />
                    {ui('decisionForTheAuthor')}
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
              {ui('originalRequest')}
            </h3>
            <p className="request-text">{request.description}</p>
            {request.proposal && (
              <>
                <h4>{ui('authorSProposal')}</h4>
                <p className="request-text">{request.proposal}</p>
              </>
            )}
            {tags.length > 0 && (
              <ul
                className="crm-request-tags"
                aria-label={ui('requestTopics2')}
              >
                {tags.map((tag) => (
                  <li key={tag}>{tag}</li>
                ))}
              </ul>
            )}
            {request.sentiment !== null && (
              <small>
                {ui('sentiment2')}
                {ui(
                  request.sentiment < 5
                    ? 'negative'
                    : request.sentiment > 5
                      ? 'positive'
                      : 'neutral',
                )}{' '}
                · {format.number(request.sentiment)}/10
              </small>
            )}
          </section>
          {materials.data && materials.data.length > 0 && (
            <section className="case-section">
              <h3>{ui('requestMaterials')}</h3>
              <div className="attachments">
                {materials.data.map((f) => (
                  <a
                    className="attachment"
                    key={f.id}
                    href={'/api/attachments/' + f.id}
                  >
                    {f.name} · {Math.ceil(f.size / 1024)} {ui('kb')}
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
                    <CheckCheck size={16} /> {ui('youAcknowledgedTheResult')}{' '}
                    {dateLabel(request.acknowledged_at, locale, ui('notSet'))}
                  </p>
                ) : (
                  <form action={dashboardAction}>
                    {versionFields}
                    <input type="hidden" name="action" value="acknowledged" />
                    <button className="btn primary">
                      {ui('acknowledgeResult')}
                    </button>
                  </form>
                )}
              </section>
            )}
          {role !== 'employee' && <ImpactDetail id={id} />}
          <PortalLink />
          {role !== 'employee' && aiConfig() && <RequestSummary key={id} id={id} />}
          <section className="crm-detail-history">
            <h3>
              <Clock3 size={17} aria-hidden="true" />
              {ui('requestHistory')}
            </h3>
            <p className="history-description">
              {ui('latestChangesFirstDecisionsRepliesAndNextSteps')}
            </p>
            <ol className="request-history">
              {[...history.data].reverse().map((event) => (
                <li key={event.id}>
                  <strong>
                    {(
                      {
                        commented: ui('comment'),
                        metadata: ui('parametersUpdated'),
                        acknowledged: ui('acknowledgedByAuthor'),
                      } as Record<string, string>
                    )[event.event_type] || t(event.event_type)}
                    <span className="history-status">{t(event.status)}</span>
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
                    <p className="request-text">
                      {(() => {
                        const metadata =
                          event.event_type === 'metadata' &&
                          /^Приоритет: (high|normal|low)\. Срок: (\d{4}-\d{2}-\d{2})$/.exec(
                            event.message,
                          )
                        if (metadata)
                          return ui('metadataEvent', {
                            priority: ui(
                              metadata[1] === 'high'
                                ? 'high'
                                : metadata[1] === 'low'
                                  ? 'low'
                                  : 'normal',
                            ),
                            date: dateLabel(metadata[2], locale, ui('notSet')),
                          })
                        if (
                          event.event_type === 'assigned' &&
                          event.message ===
                            'Назначен ответственный из резервной очереди'
                        )
                          return ui('reserveAssignedEvent')
                        return event.message
                      })()}
                    </p>
                  )}
                  {event.next_step && (
                    <p className="request-text history-next-step">
                      <strong>{ui('nextStep')}</strong>
                      {event.next_step}
                    </p>
                  )}
                </li>
              ))}
            </ol>
            <form
              action={dashboardAction}
              className="request-fields comment-box"
            >
              {versionFields}
              <input type="hidden" name="action" value="commented" />
              <label>
                {ui('comment')}
                <textarea
                  name="message"
                  rows={3}
                  maxLength={2000}
                  required
                  placeholder={ui('addDetailsOrDiscussTheNextStep')}
                />
              </label>
              <button className="btn primary">{ui('addComment')}</button>
            </form>
          </section>
        </div>
        <aside className="crm-detail-actions">
          <h3>{ui('responsibilityAndDeadline')}</h3>
          <dl className="ir-properties">
            <div>
              <dt>{ui('owner')}</dt>
              <dd>
                {(people.data?.[0]?.assignee_name === 'Резервная очередь'
                  ? null
                  : people.data?.[0]?.assignee_name) || ui('fallbackQueue')}
              </dd>
            </div>
            <div>
              <dt>{ui('author')}</dt>
              <dd>
                {(people.data?.[0]?.author_name === 'Сотрудник'
                  ? null
                  : people.data?.[0]?.author_name) || ui('employee')}
              </dd>
            </div>
            <div>
              <dt>{ui('department')}</dt>
              <dd>{request.department}</dd>
            </div>
            <div>
              <dt>
                {isDone(request) ? ui('resultPublished') : ui('reviewDeadline')}
              </dt>
              <dd className={isOverdue(request) ? 'red' : ''}>
                {dateLabel(
                  isDone(request) ? request.resolved_at : request.due_at,
                  locale,
                  ui('notSet'),
                )}
              </dd>
              {isOverdue(request) && (
                <small className="red">
                  {ui('deadlinePassedWaitingForTheOwnerSResponse')}
                </small>
              )}
            </div>
            <div>
              <dt>{ui('priority')}</dt>
              <dd>
                {request.priority === 'high'
                  ? ui('high')
                  : request.priority === 'low'
                    ? ui('low')
                    : ui('normal')}
              </dd>
            </div>
          </dl>

          {((role === 'employee' && request.status === 'clarification') ||
            ((role === 'manager' || role === 'handler') &&
              !isDone(request))) && (
            <h3>
              {role === 'employee' ? ui('yourReplyIsNeeded') : ui('review')}
            </h3>
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
                      {ui('startReview')}
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
                <h3>{ui('deadlineAndPriority')}</h3>
                <form action={dashboardAction} className="ir-flex ir-wrap">
                  {versionFields}
                  <input type="hidden" name="action" value="metadata" />
                  <label>
                    {ui('dueDate')}
                    <input
                      className="form-field"
                      type="date"
                      name="due"
                      required
                      defaultValue={request.due_at?.slice(0, 10)}
                    />
                  </label>
                  <label>
                    {ui('priority')}
                    <select
                      className="form-field"
                      name="priority"
                      defaultValue={request.priority || 'normal'}
                    >
                      <option value="low">{ui('low')}</option>
                      <option value="normal">{ui('normal')}</option>
                      <option value="high">{ui('high')}</option>
                    </select>
                  </label>
                  <button className="btn">{ui('saveParameters')}</button>
                </form>
                {role === 'admin' && !request.assignee_id && (
                  <form
                    action={dashboardAction}
                    className="ir-flex ir-wrap ir-section-gap"
                  >
                    {versionFields}
                    <input type="hidden" name="action" value="assigned" />
                    <label>
                      {ui('owner')}
                      <select className="form-field" name="assignee" required>
                        <option value="">{ui('chooseAManager')}</option>
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
                      {ui('assignFromFallbackQueue')}
                    </button>
                  </form>
                )}
              </section>
            )}
        </aside>
      </article>
    </>
  )
}

async function ImpactDetail({id}:{id:string}) {
 const db=await createClient()
 const {data}=await db.from('request_enrichments').select('report').eq('request_id',id).maybeSingle()
 return <ImpactCard id={id} report={data?.report as ImpactReport|null ?? null}/>
}
async function PortalLink(){const t=await getTranslations('productExpansion');return <Link className="btn sm" href="/feedback">{t('portal')}</Link>}
