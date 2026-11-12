import { NextResponse, type NextRequest } from 'next/server'
import { authenticate } from '../../../lib/auth-flow'

export async function POST(request: NextRequest) {
  if (request.headers.get('origin') !== new URL(request.url).origin)
    return new NextResponse('Forbidden', { status: 403 })
  let destination: string
  try { destination = await authenticate(await request.formData()) }
  catch { destination = '/login?error=connection' }
  return NextResponse.redirect(new URL(destination, request.url), {
    status: 303, headers: { 'Cache-Control': 'no-store' },
  })
}
