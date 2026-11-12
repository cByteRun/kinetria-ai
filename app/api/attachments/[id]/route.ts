import { createClient } from '../../../../lib/supabase/server'
import { getRole } from '../../../../lib/session'
import { uuidPattern } from '../../../../lib/requests'
export async function GET(
  _: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await getRole())) return new Response('Unauthorized', { status: 401 })
  const { id } = await params
  if (!uuidPattern.test(id)) return new Response('Not found', { status: 404 })
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('request_attachments')
    .select('name,content')
    .eq('id', id)
    .maybeSingle()
  if (error || !data) return new Response('Not found', { status: 404 })
  return new Response(Buffer.from(data.content, 'base64'), {
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Disposition':
        "attachment; filename*=UTF-8''" + encodeURIComponent(data.name),
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
