import { useTranslations } from 'next-intl'
import { DashboardViews } from './dashboard-views'
import { IdeaOverview } from './idea-overview'
import originalSamples from '../lib/demo-requests.json'
import topicSamples from '../lib/demo-topic-requests.json'
const samples = [...originalSamples.map(sample=>({...sample,tags:[] as string[]})), ...topicSamples]
import { RequestDrawer } from './request-drawer'
import { RequestForm } from './request-form'
import { RequestRegistry } from './request-registry'
import { requestKindLabels, type RequestStatus } from '../lib/requests'
import { canViewInsights, type Role } from '../lib/roles'

export function PreviewWorkspace({
  role,
  view,
  id,
}: {
  role: Role
  view: string
  id?: string
}) {
  const ui = useTranslations('ui')

  const names: Record<string, string> = {
    collaboration: ui('crossTeamCollaboration'),
    visibility: ui('informationTransparency'),
    catalog: ui('catalogAndData'),
    training: ui('training'),
    documents: ui('documentWorkflow'),
    processes: ui('procedures'),
    it: ui('integrationsAndIt'),
    mentoring: ui('knowledgeAndMentoring'),
    contracts: ui('contractManagement'),
    tasks: ui('tasksAndCommunication'),
    timing: ui('responseTimes'),
    communication: ui('communication'),
    projects: ui('projectWork'),
    planning: ui('resourcePlanning'),
    briefs: ui('taskBriefs'),
    workplace: ui('workplaceEnvironment'),
    filing: ui('documentStorage'),
    results: ui('outcomeTransparency'),
  }
  const categories = Object.entries(names).map(([id, name]) => ({
    id,
    name,
  }))
  const rows = samples.map((sample, index) => ({
    id: sample.id,
    number: index + 1,
    source_ref: sample.id,
    title: sample.title,
    description: sample.description,
    status: sample.status as RequestStatus,
    category_id: sample.category,
    assignee_id: null,
    kind: sample.kind as keyof typeof requestKindLabels,
    sentiment: null,
    tags: sample.tags,
    is_demo: true,
  }))
  const selected = samples.find((sample) => sample.id === id)
  return (
    <>
      {view !== 'overview' && (
        <h1>
          {view === 'overview' ? (
            <IdeaOverview
              rows={rows}
              categories={names}
              role={role}
              path={'/workspace/' + role}
            />
          ) : view === 'new' ? (
            ui('tellUsAboutYourIdea')
          ) : view === 'routing' ? (
            ui('routing')
          ) : view === 'categories' ? (
            ui('requestCategories')
          ) : (
            ui('requestRegistry')
          )}
        </h1>
      )}
      <p className="muted">
        {ui('previewUsingASyntheticDatasetConnectSupabaseTo')}
      </p>
      {view === 'overview' ? (
        <IdeaOverview
          rows={rows}
          categories={names}
          role={role}
          path={'/workspace/' + role}
        />
      ) : [
          'results',
          'analytics',
          'insights',
          'notifications',
          'help',
        ].includes(view) ? (
        <DashboardViews
          rows={rows}
          categories={names}
          path={'/workspace/' + role}
          view={view}
        />
      ) : view === 'new' ? (
        <RequestForm categories={categories} aiEnabled={false} preview />
      ) : view === 'routing' || view === 'categories' ? (
        <section className="crm-registry">
          <table>
            <thead>
              <tr>
                <th>{ui('category')}</th>
                <th>{ui('route')}</th>
              </tr>
            </thead>
            <tbody>
              {categories.map((category) => (
                <tr key={category.id}>
                  <td>{category.name}</td>
                  <td>{ui('configuredInTheConnectedDatabase')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : (
        <RequestRegistry
          canAskQvin={role === 'admin' || role === 'manager'}
          showRecurrence={canViewInsights(role)}
          path={'/workspace/' + role}
          categories={names}
          rows={rows}
        />
      )}
      {selected && (
        <RequestDrawer closeHref={'/workspace/' + role + '?view=registry'}>
          <section className="workspace-panel request-panel">
            <small>
              {selected.id} · {names[selected.category]} {ui('trainingExample')}
            </small>
            <h2>{selected.title}</h2>
            <p className="request-text">{selected.description}</p>
            <p className="muted">
              {ui('connectSupabaseToReviewRequestsAndSaveTheir')}
            </p>
          </section>
        </RequestDrawer>
      )}
    </>
  )
}
