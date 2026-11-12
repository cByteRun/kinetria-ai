import { DashboardViews } from './dashboard-views'
import { IdeaOverview } from './idea-overview'
import samples from '../lib/demo-requests.json'
import { RequestDrawer } from './request-drawer'
import { RequestForm } from './request-form'
import { RequestRegistry } from './request-registry'
import { requestKindLabels, type RequestStatus } from '../lib/requests'
import { canViewInsights, type Role } from '../lib/roles'

const names: Record<string, string> = {
  collaboration: 'Межотдельное взаимодействие',
  visibility: 'Информационная прозрачность',
  catalog: 'Каталог и данные',
  training: 'Обучение',
  documents: 'Документооборот',
  processes: 'Регламенты',
  it: 'Интеграции и IT',
  mentoring: 'Знания и наставничество',
  contracts: 'Договорная работа',
  tasks: 'Задачи и коммуникации',
  timing: 'Оперативность',
  communication: 'Коммуникации',
  projects: 'Проектная деятельность',
  planning: 'Планирование ресурсов',
  briefs: 'Постановка задач',
  workplace: 'Корпоративная среда',
  filing: 'Хранение документов',
  results: 'Прозрачность результатов',
}

export function PreviewWorkspace({
  role,
  view,
  id,
}: {
  role: Role
  view: string
  id?: string
}) {
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
            'Расскажите о своей идее'
          ) : view === 'routing' ? (
            'Маршрутизация'
          ) : view === 'categories' ? (
            'Категории обращений'
          ) : (
            'Реестр обращений'
          )}
        </h1>
      )}
      <p className="muted">
        Предпросмотр на синтетическом датасете. Для регистрации и
        рассмотрения подключите Supabase.
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
                <th>Категория</th>
                <th>Маршрут</th>
              </tr>
            </thead>
            <tbody>
              {categories.map((category) => (
                <tr key={category.id}>
                  <td>{category.name}</td>
                  <td>Настраивается в подключённой базе</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : (
        <RequestRegistry
          showRecurrence={canViewInsights(role)}
          path={'/workspace/' + role}
          categories={names}
          rows={samples.map((sample, index) => ({
            id: sample.id,
            number: index + 1,
            source_ref: sample.id,
            title: sample.title,
            status: sample.status as RequestStatus,
            category_id: sample.category,
            assignee_id: null,
            kind: sample.kind as keyof typeof requestKindLabels,
            sentiment: null,
          }))}
        />
      )}
      {selected && (
        <RequestDrawer closeHref={'/workspace/' + role + '?view=registry'}>
          <section className="workspace-panel request-panel">
            <small>
              {selected.id} · {names[selected.category]} · Учебный пример
            </small>
            <h2>{selected.title}</h2>
            <p className="request-text">{selected.description}</p>
            <p className="muted">
              Для рассмотрения обращения и сохранения истории подключите
              Supabase.
            </p>
          </section>
        </RequestDrawer>
      )}
    </>
  )
}
