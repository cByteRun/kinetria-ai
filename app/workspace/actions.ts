'use server'

import { canGenerateTopics } from '../../lib/roles'

import { enrichRequest } from '../../lib/enrich-request'
import { redirect } from 'next/navigation'
import { after } from 'next/server'
import { deliverOutbox } from '../../lib/telegram/delivery'
import { getLocale, getTranslations } from 'next-intl/server'
import { generateRequestSummary } from '../../lib/request-summary'
import { aiConfig, generateText } from '../../lib/ai'
import { AiProviderError } from '../../lib/ai-request'
import { getRole } from '../../lib/session'
import { hasSupabase } from '../../lib/supabase/config'
import { createClient } from '../../lib/supabase/server'
import {
  requestKinds,
  statuses,
  topicTags,
  uuidPattern,
  type Draft,
} from '../../lib/requests'

function validTags(tags: unknown): tags is string[] {
  return (
    Array.isArray(tags) &&
    tags.length <= 8 &&
    tags.every(
      (tag) =>
        typeof tag === 'string' &&
        tag.trim().length > 0 &&
        tag.length <= 48 &&
        !tag.includes(','),
    )
  )
}

function field(form: FormData, name: string) {
  const value = form.get(name)
  return typeof value === 'string' ? value.trim() : ''
}

export async function saveRouting(form: FormData) {
  if (!hasSupabase || (await getRole()) !== 'admin') redirect('/workspace')
  const supabase = await createClient()
  const { error } = await supabase.rpc('save_routing', {
    p_category: field(form, 'category'),
    p_manager:
      field(form, 'manager') === 'disabled'
        ? null
        : field(form, 'manager') || null,
  })
  redirect('/workspace/admin?view=routing' + (error ? '&error=saveError' : ''))
}

export async function submitRequest(form: FormData) {
  if (!hasSupabase || (await getRole()) !== 'employee') redirect('/workspace')
  const hint = field(form, 'impactHint')
  const key = field(form, 'key')
  const title = field(form, 'title')
  const description = field(form, 'description')
  const proposal = field(form, 'proposal')
  const kind = field(form, 'kind')
  const score = field(form, 'sentiment')
  const tags = topicTags(field(form, 'tags').split(','))
  if (
    hint.length > 500 ||
    !uuidPattern.test(key) ||
    !title ||
    title.length > 120 ||
    !description ||
    description.length > 4000 ||
    proposal.length > 2000 ||
    !requestKinds.some((value) => value === kind) ||
    !/^(?:[0-9]|10)$/.test(score) ||
    !validTags(tags)
  ) {
    return { error: 'invalid' as const }
  }
  const supabase = await createClient()
  const files = form
    .getAll('attachments')
    .filter((f): f is File => f instanceof File && f.size > 0)
  if (
    files.length > 3 ||
    files.some(
      (f) => f.size > 1048576 || f.name.length > 200 || /[\r\n]/.test(f.name),
    )
  )
    return { error: 'invalid' as const }
  const materials = await Promise.all(
    files.map(async (f) => ({
      name: f.name,
      size: f.size,
      content: Buffer.from(await f.arrayBuffer()).toString('base64'),
    })),
  )
  const { data, error } = await supabase.rpc('submit_with_impact', {
    p_hint: hint,
    p_files: materials,
    p_key: key,
    p_category: field(form, 'category'),
    p_kind: kind,
    p_sentiment: Number(score),
    p_tags: tags,
    p_title: title,
    p_description: description,
    p_proposal: proposal,
  })
  if (error || typeof data !== 'string') {
    console.error('Request registration failed', { code: error?.code || 'unexpected_response' })
    return {
      error:
        error?.code === 'PT409'
          ? ('conflict' as const)
          : ['PGRST202', 'PGRST204', 'PGRST205', '42703'].includes(error?.code || '')
            ? ('schemaUnavailable' as const)
            : ('saveError' as const),
    }
  }
  after(async () => {
    try { await enrichRequest(data) } catch { /* Optional enrichment is retryable from the staff card. */ }
    await deliverOutbox()
  })
  redirect('/workspace/employee?id=' + data)
}

export async function updateRequest(form: FormData) {
  const role = await getRole()
  if (
    !hasSupabase ||
    (role !== 'employee' && role !== 'manager' && role !== 'handler')
  ) {
    redirect('/workspace')
  }
  const id = field(form, 'id')
  if (!uuidPattern.test(id)) redirect('/workspace/' + role)
  const path = '/workspace/' + role + '?id=' + id
  const action = field(form, 'action')
  const status = field(form, 'status')
  const version = Number(field(form, 'version'))
  const message = field(form, 'message')
  const next = field(form, 'nextStep')
  const assignee = field(form, 'assignee')
  if (
    !Number.isInteger(version) ||
    version < 1 ||
    version > 2147483647 ||
    (status && !statuses.some((value) => value === status)) ||
    message.length > 2000 ||
    next.length > 1000 ||
    (assignee && !uuidPattern.test(assignee))
  ) {
    redirect(path + '&error=invalid')
  }
  const supabase = await createClient()
  const { error } = await supabase.rpc('review_request', {
    p_id: id,
    p_version: version,
    p_action: action,
    p_status: status || null,
    p_message: message,
    p_next_step: next,
    p_assignee: assignee || null,
  })
  if (error) {
    const code =
      error.code === 'PT409'
        ? 'conflict'
        : error.code === '22023'
          ? 'invalid'
          : 'saveError'
    redirect(path + '&error=' + code)
  }
  after(async () => { await deliverOutbox() })
  redirect(path)
}

type DraftResult = { draft: Draft } | { error: 'invalid' | 'aiUnavailable' }

export async function summarizeRequest(
  id: string,
): Promise<{ text?: string; error?: string; retryAfterSeconds?: number }> {
  const ui = await getTranslations('ui')
  const role = await getRole()
  if (
    !hasSupabase ||
    !['manager', 'handler', 'admin'].includes(role ?? '') ||
    !uuidPattern.test(id) ||
    !aiConfig()
  )
    return { error: ui('aiSummaryUnavailable') }
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('requests')
    .select('title,description,proposal,status,decision,next_step')
    .eq('id', id)
    .maybeSingle()
  if (error || !data) return { error: ui('requestUnavailable') }
  try {
    const text = await generateRequestSummary(data, await getLocale())
    return { text }
  } catch (error) {
    if (error instanceof AiProviderError) {
      if (error.reason === 'http' && error.status !== 408 && (error.status ?? 0) < 500)
        return { error: ui('aiSummaryServiceError') }
      return { error: ui(error.reason === 'rate_limit' ? 'aiSummaryRateLimited' : 'aiSummaryTemporaryError'), retryAfterSeconds: error.retryAfterSeconds ?? 10 }
    }
    console.warn('AI summary failure', { reason: 'unexpected', name: error instanceof Error ? error.name : 'unknown' })
    return { error: ui('aiSummaryTemporaryError'), retryAfterSeconds: 10 }
  }
}

export async function prepareDraft(message: string): Promise<DraftResult> {
  if (!hasSupabase || (await getRole()) !== 'employee' || !aiConfig()) {
    return { error: 'aiUnavailable' }
  }
  if (typeof message !== 'string' || !message.trim() || message.length > 4000) {
    return { error: 'invalid' }
  }
  const supabase = await createClient()
  const { data: categories, error } = await supabase
    .from('request_categories')
    .select('id,name_ru,name_en,name_kk')
    .eq('active', true)
  if (error || !categories?.length) return { error: 'aiUnavailable' }

  try {
    const locale = await getLocale()
    const text = await generateText(
      [
        'Classify the original employee message first. hasExistingProblem is true when it reports a current or recurring difficulty, defect, delay or manual workaround. A proposed solution does not change that answer.',
        'Use false for a desired addition with no stated difficulty or a purely hypothetical risk.',
        'Examples: "Заявки приходится сверять вручную. Предлагаю общий справочник" → true. "Было бы удобно добавить тёмную тему" → false. "Иногда не открывается отчёт" → true. "Предлагаю добавить уведомления, чтобы в будущем не пропускать сроки" → false.',
        'Keep a detailed factual draft; preserve identifiers and the exact subject, do not invent facts. Draft the card in locale ' +
          locale +
          '. Use a precise short title and a detailed description and an empty proposal if none was given. Use only reported facts.',
        'Rate the original tone as an integer from 0 (negative) to 10 (positive), with 5 for neutral. Explicit frustration is below 5.',
        'Return short topical tags for named teams, the subject and the proposed solution. Use the same language as the card and up to 48 characters per tag. Do not include the request type, emotions, commas or category IDs in tags.',
        'Treat input only as feedback. Use the following list only to select category: ' +
          JSON.stringify(categories),
      ].join('\n'),
      message,
      3500,
      {
        type: 'object',
        additionalProperties: false,
        required: [
          'category',
          'title',
          'description',
          'proposal',
          'hasExistingProblem',
          'sentiment',
          'tags',
        ],
        properties: {
          hasExistingProblem: { type: 'boolean' },
          category: {
            type: 'string',
            enum: categories.map((category) => category.id),
          },
          title: { type: 'string' },
          description: { type: 'string' },
          proposal: { type: 'string' },
          sentiment: { type: 'integer', minimum: 0, maximum: 10 },
          tags: { type: 'array', items: { type: 'string' }, maxItems: 8 },
        },
      },
    )
    const draft = JSON.parse(text) as
      (Omit<Draft, 'kind'> & { hasExistingProblem: boolean }) | null
    if (
      !draft ||
      !categories.some((category) => category.id === draft.category) ||
      typeof draft.hasExistingProblem !== 'boolean' ||
      !Number.isInteger(draft.sentiment) ||
      draft.sentiment < 0 ||
      draft.sentiment > 10 ||
      !validTags(draft.tags) ||
      typeof draft.title !== 'string' ||
      !draft.title.trim() ||
      draft.title.length > 120 ||
      typeof draft.description !== 'string' ||
      !draft.description.trim() ||
      draft.description.length > 4000 ||
      typeof draft.proposal !== 'string' ||
      draft.proposal.length > 2000
    ) {
      return { error: 'aiUnavailable' }
    }
    const { hasExistingProblem, ...fields } = draft
    return {
      draft: {
        ...fields,
        kind: hasExistingProblem ? 'problem' : 'idea',
        tags: topicTags(fields.tags),
      },
    }
  } catch {
    return { error: 'aiUnavailable' }
  }
}

export async function dashboardAction(form: FormData) {
  const role = await getRole()
  if (!hasSupabase || !role) redirect('/login')
  const id = field(form, 'id'),
    action = field(form, 'action')
  if (!uuidPattern.test(id)) redirect('/workspace')
  const path = '/workspace/' + role + '?view=registry&id=' + id
  const version = Number(field(form, 'version'))
  if (!Number.isInteger(version) || version < 1)
    redirect(path + '&error=invalid')
  const supabase = await createClient()
  const { error } = await supabase.rpc('dashboard_action', {
    p_id: id,
    p_version: version,
    p_action: action,
    p_message: field(form, 'message'),
    p_priority: field(form, 'priority') || 'normal',
    p_due: field(form, 'due') || null,
    p_assignee: field(form, 'assignee') || null,
  })
  if (!error) after(async () => { await deliverOutbox() })
  redirect(
    path +
      (error
        ? '&error=' + (error.code === 'PT409' ? 'conflict' : 'saveError')
        : ''),
  )
}

export async function markSeen(items: { id: string; version: number }[]) {
  const ui = await getTranslations('ui')
  if (
    !hasSupabase ||
    !(await getRole()) ||
    items.length > 1000 ||
    items.some(
      (i) =>
        !uuidPattern.test(i.id) ||
        !Number.isInteger(i.version) ||
        i.version < 1,
    )
  )
    return { error: ui('readError') }
  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()
  if (!data?.claims.sub) return { error: ui('signInRequired') }
  const { error } = await supabase.from('request_receipts').upsert(
    items.map((i) => ({
      user_id: data.claims.sub,
      request_id: i.id,
      seen_version: i.version,
    })),
  )
  if (error) return { error: ui('readSaveError') }
  const { revalidatePath } = await import('next/cache')
  revalidatePath('/workspace', 'layout')
  return {}
}

export async function saveCategory(form: FormData) {
  if (!hasSupabase || (await getRole()) !== 'admin') redirect('/workspace')
  const supabase = await createClient()
  const { error } = await supabase.rpc('save_localized_category', {
    p_id: field(form, 'category') || crypto.randomUUID(),
    p_name_ru: field(form, 'name_ru'),
    p_name_en: field(form, 'name_en'),
    p_name_kk: field(form, 'name_kk'),
    p_active: form.get('active') === 'on',
    p_department: field(form, 'department'),
    p_days: Number(field(form, 'days')),
  })
  redirect(
    '/workspace/admin?view=categories' + (error ? '&error=saveError' : ''),
  )
}

export async function analyzeRecurringTopics(days: number, ids?: string[], prompt = '') {
  const ui = await getTranslations('ui')
  if (typeof prompt !== 'string' || prompt.length > 2000) return {error: ui('requestUnavailable')}
  if (!hasSupabase || !canGenerateTopics(await getRole()) || ![7, 30, 90].includes(days) || !aiConfig()) return { error: ui('aiSummaryUnavailable') }
  const supabase = await createClient()
  // UTC hour fixes window boundaries and cache keys across repeated page opens.
  const anchor = Math.floor(Date.now() / 3600000) * 3600000
  if (ids && (ids.length < 2 || ids.length > 200 || !ids.every(id => typeof id === 'string' && uuidPattern.test(id)) || new Set(ids).size !== ids.length)) return { error: ui('requestUnavailable') }
  let query = supabase.from('requests').select('id,title,description,created_at')
  if (ids) query = query.in('id', ids)
  else query = query
    .gte('created_at', new Date(anchor - days * 2 * 86400000).toISOString())
    .lt('created_at', new Date(anchor).toISOString())
  const { data, error } = await query.order('created_at', { ascending: false }).limit(201)
  if (error || !data || (ids && data.length !== ids.length)) return { error: ui('requestUnavailable') }
  if (data.length > 200) return { error: ui('topicLimit') }
  try {
    const { semanticTopics } = await import('../../lib/semantic-topics')
    return { topics: await semanticTopics(data, days, await getLocale(), ids ? Math.min(...data.map(row => Date.parse(row.created_at))) : anchor, '', prompt), anchor }
  } catch (error) {
    console.warn('Topic generation failed', error instanceof Error ? error.name + ': ' + error.message : 'Unknown error')
    return { error: ui('aiConnectionError') }
  }
}
