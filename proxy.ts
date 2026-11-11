import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { hasSupabase, supabaseKey, supabaseUrl } from './lib/supabase/config'

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request })
  if (!hasSupabase) return response

  const supabase = createServerClient(supabaseUrl!, supabaseKey!, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(values) {
        values.forEach(({ name, value }) => request.cookies.set(name, value))
        response = NextResponse.next({ request })
        values.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        )
      },
    },
  })
  await supabase.auth.getClaims()
  return response
}

export const config = { matcher: ['/login', '/workspace/:path*'] }
