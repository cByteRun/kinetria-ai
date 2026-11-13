import { NextResponse, type NextRequest } from 'next/server'

// Persist only the preference: changing theme must not refresh server data.
export async function POST(request: NextRequest) {
  if (request.headers.get('origin') !== new URL(request.url).origin)
    return new NextResponse('Forbidden', { status: 403 })
  const body: unknown = await request.json().catch(() => null)
  const theme = body && typeof body === 'object' && 'theme' in body ? body.theme : null
  if (theme !== 'light' && theme !== 'dark')
    return new NextResponse('Invalid theme', { status: 400 })
  const response = new NextResponse(null, {
    status: 204,
    headers: { 'Cache-Control': 'no-store' },
  })
  response.cookies.set('kinetria_theme', theme, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 365 * 24 * 60 * 60,
  })
  return response
}
