import { NextResponse, type NextRequest } from 'next/server'
import { endSession } from '../../../lib/auth-flow'

export async function POST(request: NextRequest) {
  if (request.headers.get('origin') !== new URL(request.url).origin)
    return new NextResponse('Forbidden', { status: 403 })
  await endSession()
  return NextResponse.redirect(new URL('/login', request.url), {
    status: 303, headers: { 'Cache-Control': 'no-store' },
  })
}
