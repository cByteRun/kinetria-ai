export class AiProviderError extends Error {
  constructor(
    public readonly reason: 'rate_limit' | 'http' | 'network' | 'incomplete',
    public readonly status?: number,
    public readonly retryAfterSeconds?: number,
  ) { super(`AI request failed: ${reason}`) }
}

export function retryAfterSeconds(value: string | null) {
  if (!value?.trim()) return undefined
  const seconds = Number(value)
  const delay = Number.isFinite(seconds) ? seconds : (Date.parse(value) - Date.now()) / 1000
  return Number.isFinite(delay) && delay >= 0 ? Math.max(1, Math.ceil(delay)) : undefined
}

// Two attempts at most. Long provider cooldowns return to the UI immediately.
export async function requestGroqText(key: string, body: object) {
  for (let attempt = 0; attempt < 2; attempt++) {
    let failure: AiProviderError
    try {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + key },
        signal: AbortSignal.timeout(20000),
        body: JSON.stringify(body),
      })
      if (!response.ok) {
        failure = new AiProviderError(response.status === 429 ? 'rate_limit' : 'http', response.status,
          retryAfterSeconds(response.headers.get('retry-after')) ?? (response.status === 429 ? 60 : undefined))
        await response.body?.cancel()
      } else {
        const result = await response.json(), choice = result.choices?.[0]
        if (choice?.finish_reason === 'stop' && typeof choice.message?.content === 'string' && choice.message.content.trim()) return choice.message.content as string
        failure = new AiProviderError('incomplete')
      }
    } catch {
      failure = new AiProviderError('network')
    }
    const retryable = failure.reason !== 'http' || failure.status === 408 || (failure.status ?? 0) >= 500
    const willRetry = attempt === 0 && retryable && (failure.retryAfterSeconds ?? 1) <= 2
    // Never log keys, prompts, generated content or the upstream error body.
    console.warn('AI provider failure', { provider: 'groq', reason: failure.reason, status: failure.status,
      retryAfterSeconds: failure.retryAfterSeconds, attempt: attempt + 1, willRetry })
    if (!willRetry) throw failure
    await new Promise(resolve => setTimeout(resolve, (failure.retryAfterSeconds ?? 1) * 1000))
  }
  throw new AiProviderError('network')
}
