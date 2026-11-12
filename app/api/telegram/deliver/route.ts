import { secretMatches } from '../../../../lib/telegram/api'
import { deliverOutbox } from '../../../../lib/telegram/delivery'
export const runtime = 'nodejs'
export const maxDuration = 60
export async function POST(request: Request) {
  if (!secretMatches(request.headers.get('authorization'), process.env.CRON_SECRET ? 'Bearer ' + process.env.CRON_SECRET : undefined)) return new Response('Unauthorized', { status: 401 })
  return Response.json(await deliverOutbox())
}
// Vercel Cron and schedulers using GET share the same bearer authentication.
export const GET = POST
