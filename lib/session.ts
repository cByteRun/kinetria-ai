import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import { cache } from 'react'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { isRole, type Role } from './roles'
import { createClient } from './supabase/server'
import { hasSupabase, supabaseKey, supabaseUrl } from './supabase/config'

export const demoCookie = 'kinetria_demo'
const sessionLifetime = 60 * 60 * 4
export const localPreview =
  process.env.NODE_ENV === 'development' && !supabaseUrl && !supabaseKey
const processState = globalThis as typeof globalThis & {
  kinetriaPreviewKey?: Buffer
}

function sign(payload: string) {
  processState.kinetriaPreviewKey ??= randomBytes(32)
  return createHmac('sha256', processState.kinetriaPreviewKey)
    .update(payload)
    .digest('hex')
}

export async function startPreview(role: Role) {
  if (!localPreview) return
  const payload = `${role}.${Date.now() + sessionLifetime * 1000}`
  const jar = await cookies()
  jar.set(demoCookie, `${payload}.${sign(payload)}`, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: sessionLifetime,
  })
}

export const getProfile = cache(async (): Promise<{ role: Role; displayName: string | null } | null> => {
  if (hasSupabase) {
    const supabase = await createClient()
    const { data } = await supabase.auth.getClaims()
    if (!data?.claims.sub) return null
    const { data: profile } = await supabase
      .from('profiles')
      .select('role,display_name')
      .eq('id', data.claims.sub)
      .eq('active', true)
      .maybeSingle()
    return isRole(profile?.role) ? { role: profile.role, displayName: profile.display_name } : null
  }

  if (!localPreview) return null
  const [role, expires, signature, extra] =
    (await cookies()).get(demoCookie)?.value.split('.') ?? []
  if (
    !isRole(role) ||
    !/^\d{13}$/.test(expires ?? '') ||
    Number(expires) <= Date.now() ||
    !/^[a-f0-9]{64}$/.test(signature ?? '') ||
    extra !== undefined
  )
    return null
  const expected = sign(`${role}.${expires}`)
  return timingSafeEqual(
    Buffer.from(signature, 'hex'),
    Buffer.from(expected, 'hex'),
  )
    ? { role, displayName: null }
    : null
})

export async function getRole(): Promise<Role | null> {
  return (await getProfile())?.role ?? null
}

export async function requireProfile() {
  const profile = await getProfile()
  if (!profile) redirect('/login')
  return profile
}

export async function requireRole() {
  return (await requireProfile()).role
}
