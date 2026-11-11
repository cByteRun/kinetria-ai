import { redirect } from 'next/navigation'
import { requireRole } from '../../lib/session'

export default async function Workspace() {
  redirect(`/workspace/${await requireRole()}`)
}
