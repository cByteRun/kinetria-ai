import { notFound } from 'next/navigation'
import { getTheme } from '../../../i18n/theme'
import { canViewInsights, isRole } from '../../../lib/roles'
import { requireProfile, localPreview } from '../../../lib/session'
import accounts from '../../../lib/demo-accounts.json'
import { hasSupabase } from '../../../lib/supabase/config'
import { DashboardShell } from '../../../components/dashboard-shell'
import { RequestWorkspace } from '../../../components/request-workspace'
import { PreviewWorkspace } from '../../../components/preview-workspace'
import '../dashboard.css'
import '../prototype.css'
import '../live-dashboard.css'
import '../adaptive.css'

export default async function RoleWorkspace({
  params,
  searchParams,
}: {
  params: Promise<{ role: string }>
  searchParams: Promise<{ error?: string; id?: string; view?: string }>
}) {
  const profile = await requireProfile()
  const { role } = await params
  if (!isRole(role) || role !== profile.role) notFound()
  const { error, id, view: selection } = await searchParams
  const view = selection || (id ? 'registry' : 'overview')
  if (
    (view === 'analytics' || view === 'insights') &&
    !canViewInsights(role)
  )
    notFound()
  const theme = await getTheme()
  const name =
    profile.displayName ||
    (localPreview
      ? accounts.find((account) => account.id === role)?.name
      : undefined)
  return (
    <DashboardShell role={role} view={view} theme={theme} name={name}>
      {role === 'client' ? (
        <section className="workspace-panel request-panel">
          <h1>Feedback Portal</h1>
          <p>
            Клиентский канал предусмотрен на следующем этапе развития
            IdeaRoute.
          </p>
        </section>
      ) : hasSupabase ? (
        <RequestWorkspace role={role} id={id} error={error} view={view} />
      ) : (
        <PreviewWorkspace role={role} view={view} id={id} />
      )}
    </DashboardShell>
  )
}
