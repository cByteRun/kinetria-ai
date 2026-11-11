import { createClient } from '@supabase/supabase-js'

const { NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY, KINETRIA_DEMO_PASSWORD } = process.env
if (!NEXT_PUBLIC_SUPABASE_URL || !SUPABASE_SECRET_KEY || !KINETRIA_DEMO_PASSWORD) {
  throw new Error('Set the demo project URL, secret key and demo password.')
}

const supabase = createClient(NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const existing = new Map()
for (let page = 1; ; page += 1) {
  const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 })
  if (error) throw error
  data.users.forEach(user => existing.set(user.email, user))
  if (data.users.length < 200) break
}

for (const role of ['employee', 'handler', 'manager', 'admin', 'client']) {
  const email = `${role}@kinetria.example`
  const user = existing.get(email)
  if (user && user.app_metadata.kinetria_demo !== true) {
    throw new Error(`Existing user ${email} is not a Kinetria demo account.`)
  }

  const attributes = { password: KINETRIA_DEMO_PASSWORD, email_confirm: true, app_metadata: { kinetria_demo: true } }
  const { data, error } = user
    ? await supabase.auth.admin.updateUserById(user.id, attributes)
    : await supabase.auth.admin.createUser({ ...attributes, email })
  if (error) throw error
  const profile = await supabase.from('profiles').upsert({ id: data.user.id, role, active: true })
  if (profile.error) throw profile.error
  console.log(`Prepared ${role}`)
}
