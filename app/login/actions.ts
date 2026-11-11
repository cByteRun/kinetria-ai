'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { isRole, roles } from '../../lib/roles'
import {
  demoCookie,
  getRole,
  localPreview,
  startPreview,
} from '../../lib/session'
import { hasSupabase } from '../../lib/supabase/config'
import { createClient } from '../../lib/supabase/server'

export async function login(form: FormData) {
  const selection = form.get('role')
  if (selection !== null && !isRole(selection))
    redirect('/login?error=credentials')
  if (localPreview && isRole(selection)) {
    await startPreview(selection)
    redirect('/workspace')
  }

  if (!hasSupabase) redirect('/login?error=config')
  const email = isRole(selection) ? roles[selection].email : form.get('email')
  const password = isRole(selection)
    ? process.env.KINETRIA_DEMO_PASSWORD
    : form.get('password')
  if (
    typeof email !== 'string' ||
    typeof password !== 'string' ||
    !email ||
    !password
  ) {
    redirect('/login?error=credentials')
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) redirect('/login?error=credentials')
  if (!(await getRole())) {
    await supabase.auth.signOut({ scope: 'local' })
    redirect('/login?error=profile')
  }
  redirect('/workspace')
}

export async function logout() {
  if (hasSupabase) {
    const supabase = await createClient()
    const { error } = await supabase.auth.signOut({ scope: 'local' })
    if (error) redirect('/workspace?error=logout')
  }
  const jar = await cookies()
  jar.delete(demoCookie)
  redirect('/login')
}
