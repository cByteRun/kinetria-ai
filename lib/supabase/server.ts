import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { supabaseKey, supabaseUrl } from './config'

export async function createClient(timeoutMs?: number) {
  const jar = await cookies()
  return createServerClient(supabaseUrl!, supabaseKey!, {
    ...(timeoutMs ? { global: { fetch: (input: RequestInfo | URL, init?: RequestInit) =>
      fetch(input, { ...init, signal: AbortSignal.any([
        AbortSignal.timeout(timeoutMs), ...(init?.signal ? [init.signal] : []),
      ]) }) } } : {}),
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
