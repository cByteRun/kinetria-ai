import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { supabaseKey, supabaseUrl } from './config'

export async function createClient() {
  const jar = await cookies()
  return createServerClient(supabaseUrl!, supabaseKey!, {
    cookies: {
      getAll: () => jar.getAll(),
      setAll(values) {
        try {
          values.forEach(({ name, value, options }) =>
            jar.set(name, value, options),
          )
        } catch {
          // Proxy refreshes cookies for requests rendered by Server Components.
        }
      },
    },
  })
}
