import { notFound } from 'next/navigation'
import { DashboardShell } from '../../../components/dashboard-shell'
import { getTheme } from '../../../i18n/theme'
import { isRole } from '../../../lib/roles'
import { localPreview, requireProfile } from '../../../lib/session'
import accounts from '../../../lib/demo-accounts.json'

export default async function WorkspaceLayout({ children, params }: {
  children: React.ReactNode; params: Promise<{ role: string }>
}) {
  const [profile, theme, { role }] = await Promise.all([requireProfile(), getTheme(), params])
  if (!isRole(role) || role !== profile.role) notFound()
  const name = profile.displayName || (localPreview ? accounts.find(account => account.id === role)?.name : undefined)
  return <DashboardShell role={role} theme={theme} name={name}>{children}</DashboardShell>
}
