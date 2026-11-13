import { NextRequest, NextResponse } from 'next/server'
import { getProfile } from '../../../../lib/session'
import { maxVoiceBytes, speechConfigured, transcribeAudio } from '../../../../lib/speech'

export const runtime = 'nodejs'
export const maxDuration = 30

function failure(error: string, status: number) {
  return NextResponse.json({ error }, { status, headers: { 'Cache-Control': 'no-store' } })
}

export async function POST(request: NextRequest) {
  if (request.headers.get('origin') !== request.nextUrl.origin) return failure('forbidden', 403)
  const profile = await getProfile()
  if (!profile) return failure('unauthorized', 401)
  if (profile.role !== 'employee') return failure('forbidden', 403)
  if (!speechConfigured()) return failure('unavailable', 503)
  if (!request.headers.get('content-type')?.startsWith('multipart/form-data;')) return failure('invalid', 400)
  // Bound the actual stream, including chunked uploads without Content-Length.
  const limit = maxVoiceBytes + 64 * 1024
  if (Number(request.headers.get('content-length')) > limit) return failure('tooLarge', 413)
  const reader = request.body?.getReader()
  if (!reader) return failure('invalid', 400)
  let audio: File
  let extension: string
  try {
    const chunks: Uint8Array[] = []
    let size = 0
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > limit) { await reader.cancel(); return failure('tooLarge', 413) }
      chunks.push(value)
    }
    const body = Buffer.concat(chunks)
    const form = await new Response(body, { headers: { 'Content-Type': request.headers.get('content-type')! } }).formData()
    const file = form.get('audio')
    if (!(file instanceof File) || !file.size) return failure('empty', 400)
    audio = file
    if (audio.size > maxVoiceBytes) return failure('tooLarge', 413)
    const extensions: Record<string, string> = { 'audio/webm': 'webm', 'audio/ogg': 'ogg', 'audio/mp4': 'mp4', 'audio/wav': 'wav' }
    extension = extensions[audio.type.split(';')[0]]
    if (!extension) return failure('invalid', 415)
  } catch {
    return failure('invalid', 400)
  } finally {
    reader.releaseLock()
  }
  try {
    const text = await transcribeAudio(audio, 'voice.' + extension)
    return NextResponse.json({ text }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    return failure(error instanceof Error && error.message === 'Invalid transcript' ? 'empty' : 'unavailable', 502)
  }
}
