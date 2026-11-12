import { cookies } from 'next/headers'
import { isRole, roles, type Role } from './roles'
import accounts from './demo-accounts.json'
import {
  demoCookie,
  localPreview,
  startPreview,
} from './session'
import { hasSupabase } from './supabase/config'
import { createClient } from './supabase/server'

// Intent is a section name, never a redirect URL. The authenticated role is authoritative.
export function roleDestination(role: Role, intent?: FormDataEntryValue | null) {
  const allowed: Record<Role, readonly string[]> = {
    employee: ['new', 'registry', 'results'],
    manager: ['registry', 'analytics', 'results'],
    handler: ['registry', 'results', 'analytics'],
    admin: ['routing', 'analytics', 'registry'],
    client: ['overview'],
  }
  const view = typeof intent === 'string' && allowed[role].includes(intent)
    ? intent : allowed[role][0]
  return `/workspace/${role}?view=${view}`
}

export async function authenticate(form: FormData) {
  const selection = form.get('role')
  const accountId = form.get('account')
  const account = accounts.find(item => item.id === accountId)
  if (accountId !== null && (!account || selection !== null || !process.env.KINETRIA_DEMO_PASSWORD))
    return '/login?error=credentials'
  if (selection !== null && !isRole(selection))
    return '/login?error=credentials'
  if (localPreview && isRole(selection)) {
    await startPreview(selection)
    return roleDestination(selection, form.get('intent'))
  }

  if (!hasSupabase) return '/login?error=config'
  const email = account ? account.id + '@kinetria.example' : isRole(selection) ? roles[selection].email : form.get('email')
  const password = account || isRole(selection)
    ? process.env.KINETRIA_DEMO_PASSWORD
    : form.get('password')
  if (
    typeof email !== 'string' ||
    typeof password !== 'string' ||
    !email ||
    !password
  ) {
    return '/login?error=credentials'
  }

  const supabase = await createClient(8000)
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) return '/login?error=credentials'
  const { data: profile, error: profileError } = await supabase.from('profiles')
    .select('role').eq('id', data.user.id).eq('active', true).maybeSingle()
  if (profileError || !isRole(profile?.role)) {
    await supabase.auth.signOut({ scope: 'local' })
    return '/login?error=profile'
  }
  return roleDestination(profile.role, form.get('intent'))
}

export async function endSession() {
  const jar = await cookies()
  try {
    if (hasSupabase) {
      const supabase = await createClient(5000)
      await supabase.auth.signOut({ scope: 'local' })
    }
  } catch {
    // Local cookie removal below still completes sign-out on network failure.
  } finally {
    // End this browser session even if the remote revocation is unavailable.
    if (hasSupabase) {
      const key = `sb-${new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).hostname.split('.')[0]}-auth-token`
      for (const cookie of jar.getAll())
        if (cookie.name === key || cookie.name.startsWith(key + '.') || cookie.name === key + '-code-verifier')
          jar.delete(cookie.name)
    }
    jar.delete(demoCookie)
  }
  return '/login'
}
