export function aiConfig() {
  const provider = process.env.AI_PROVIDER?.trim().toLowerCase() || 'openai'
  if (provider === 'gemini' && process.env.GEMINI_API_KEY) {
    return { provider, key: process.env.GEMINI_API_KEY, model: process.env.GEMINI_MODEL || 'gemini-2.5-flash' } as const
  }
  if (provider === 'openai' && process.env.OPENAI_API_KEY) {
    return { provider, key: process.env.OPENAI_API_KEY, model: process.env.OPENAI_MODEL || 'gpt-4.1-mini' } as const
  }
  return null
}

export async function generateText(instructions: string, input: string, maxTokens: number, schema?: object) {
  const config = aiConfig()
  if (!config) throw new Error('AI provider is not configured')
  const gemini = config.provider === 'gemini'
  const response = await fetch(gemini
    ? 'https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(config.model) + ':generateContent'
    : 'https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(gemini
      ? { 'x-goog-api-key': config.key } : { Authorization: 'Bearer ' + config.key }) },
    signal: AbortSignal.timeout(20000),
    body: JSON.stringify(gemini ? {
      systemInstruction: { parts: [{ text: instructions }] },
      contents: [{ role: 'user', parts: [{ text: input }] }],
      generationConfig: {
        maxOutputTokens: maxTokens,
        ...(schema && { responseMimeType: 'application/json', responseJsonSchema: schema }),
      },
    } : {
      model: config.model, store: false, max_output_tokens: maxTokens, instructions, input,
      ...(schema && { text: { format: { type: 'json_schema', name: 'request_draft', strict: true, schema } } }),
    }),
  })
  if (!response.ok) throw new Error('AI provider request failed')
  const result = await response.json()
  const candidate = result.candidates?.[0]
  const text = gemini
    ? candidate?.finishReason === 'STOP' && candidate.content?.parts
      ?.filter((part: { thought?: boolean }) => !part.thought).map((part: { text?: string }) => part.text).join('')
    : result.status === 'completed' && result.output?.find((item: { type: string }) => item.type === 'message')
      ?.content?.find((item: { type: string }) => item.type === 'output_text')?.text
  if (typeof text !== 'string' || !text.trim()) throw new Error('AI provider returned no complete text')
  return text
}
