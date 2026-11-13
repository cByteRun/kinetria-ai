// Shared by Telegram and the web composer. Credentials stay on the server.
export const maxVoiceBytes = 3 * 1024 * 1024

export function speechConfigured() {
  return Boolean(process.env.GROQ_API_KEY)
}

export async function transcribeAudio(audio: Blob, filename: string) {
  if (!speechConfigured()) throw new Error('Speech unavailable')
  if (!audio.size || audio.size > maxVoiceBytes) throw new Error('Invalid audio')
  const form = new FormData()
  form.set('file', audio, filename)
  form.set('model', process.env.GROQ_WHISPER_MODEL || 'whisper-large-v3-turbo')
  form.set('response_format', 'json')
  const response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
    method: 'POST', headers: { Authorization: 'Bearer ' + process.env.GROQ_API_KEY }, body: form,
    signal: AbortSignal.timeout(20000), cache: 'no-store',
  })
  if (!response.ok) throw new Error('Speech unavailable')
  const value: unknown = await response.json()
  if (!value || typeof value !== 'object' || !('text' in value) ||
    typeof value.text !== 'string' || !value.text.trim() || value.text.length > 4000) {
    throw new Error('Invalid transcript')
  }
  return value.text.trim()
}
