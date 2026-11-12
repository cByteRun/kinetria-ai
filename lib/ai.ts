export function aiConfig() {
  const provider = process.env.AI_PROVIDER?.trim().toLowerCase()
  if (provider === 'groq' && process.env.GROQ_API_KEY) {
    return { provider, key: process.env.GROQ_API_KEY, model: process.env.GROQ_TEXT_MODEL || 'qwen/qwen3.8-27b' } as const
  }
  if (process.env.VERCEL === '1' || process.env.VERCEL_ENV) return null
  if (provider === 'ollama' && process.env.OLLAMA_MODEL) {
    return { provider, model: process.env.OLLAMA_MODEL } as const
  }
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
  if (config.provider === 'ollama') {
    const response = await fetch('http://127.0.0.1:11434/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(90000),
      body: JSON.stringify({
        model: config.model,
        messages: [
          { role: 'system', content: instructions },
          { role: 'user', content: input },
        ],
        stream: false,
        think: false,
        options: { num_ctx: 4096, num_predict: Math.min(maxTokens, schema ? 1536 : 512), temperature: 0 },
        ...(schema && { format: schema }),
      }),
    })
    if (!response.ok) throw new Error('Ollama request failed')
    const result = await response.json()
    const text = result.message?.content
    if (!result.done || result.done_reason !== 'stop' || typeof text !== 'string' || !text.trim()) {
      throw new Error('Ollama returned no complete text')
    }
    return text
  }
  if (config.provider === 'groq') {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + config.key },
      signal: AbortSignal.timeout(12000),
      body: JSON.stringify({ model: config.model, temperature: 0, max_completion_tokens: maxTokens,
        ...(config.model.startsWith('qwen/') && { reasoning_format: 'hidden', reasoning_effort: 'none' }),
        messages: [{ role: 'system', content: instructions + (schema ? '\nReturn JSON matching this schema: ' + JSON.stringify(schema) : '') }, { role: 'user', content: input }],
        ...(schema && { response_format: { type: 'json_object' } }),
      }),
    })
    if (!response.ok) throw new Error('Groq unavailable')
    const result = await response.json(), choice = result.choices?.[0]
    if (choice?.finish_reason !== 'stop' || typeof choice.message?.content !== 'string' || !choice.message.content.trim()) throw new Error('Groq incomplete response')
    return choice.message.content as string
  }
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
