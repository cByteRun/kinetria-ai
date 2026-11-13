import { Preferences } from '../../../components/preferences'
import { getTheme, getColorTheme } from '../../../i18n/theme'
import { Suspense } from 'react'
import WorkspaceLoading from '../loading'
import { getTranslations } from 'next-intl/server'
import { redirect } from 'next/navigation'
import { notFound } from 'next/navigation'
import { canViewInsights, isRole } from '../../../lib/roles'
import { requireProfile } from '../../../lib/session'
import { hasSupabase } from '../../../lib/supabase/config'
import { RequestWorkspace } from '../../../components/request-workspace'
import { PreviewWorkspace } from '../../../components/preview-workspace'

export default async function RoleWorkspace({
  params,
  searchParams,
}: {
  params: Promise<{ role: string }>
  searchParams: Promise<{ error?: string; id?: string; view?: string; mode?: string }>
}) {
  const [ui, profile] = await Promise.all([
    getTranslations('ui'), requireProfile(),
  ])
  const { role } = await params
  if (!isRole(role) || role !== profile.role) notFound()
  const { error, id, view: selection } = await searchParams
  const view = selection || (id ? 'registry' : 'overview')
  if (role === 'client') redirect('/feedback')
  if (view === 'portal') redirect('/feedback')
  if (view === 'profile') {
    const [theme, colorTheme, roles, shell] = await Promise.all([getTheme(), getColorTheme(), getTranslations('roles'), getTranslations('dashboardShell')])
    return <section className="card profile-settings"><h1>{shell('profile')}</h1>
      <p>{profile.displayName || roles(role)} · {roles(role)}</p>
      <Preferences theme={theme} colorTheme={colorTheme} />
    </section>
  }
  if ((view === 'analytics' || view === 'insights') && !canViewInsights(role))
    notFound()
  return (
      <Suspense key={`${role}:${view}:${id || ''}`} fallback={<WorkspaceLoading />}>
        {hasSupabase ? (
          <RequestWorkspace role={role} id={id} error={error} view={view} />
        ) : (
          <PreviewWorkspace role={role} view={view} id={id} />
        )}
      </Suspense>
  )
}
