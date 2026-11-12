export const statuses = ['new', 'review', 'clarification', 'in_progress', 'implemented', 'rejected', 'closed'] as const

export type RequestStatus = (typeof statuses)[number]
export type Category = { id: string; name_ru: string; name_en: string; name_kk: string }
export const requestKinds = ['problem', 'idea'] as const
export type RequestKind = (typeof requestKinds)[number]
export const requestKindLabels = { problem: 'Проблема', idea: 'Пожелание', praise: 'Отзыв' }

const typeTags = new Set([
  'проблема', 'пожелание', 'идея', 'отзыв',
  'problem', 'issue', 'idea', 'suggestion', 'wish', 'praise',
  'мәселе', 'ұсыныс', 'тілек', 'пікір',
])

export function topicTags(tags: string[]) {
  return [...new Set(tags.map(tag => tag.trim()).filter(tag => tag && !typeTags.has(tag.toLowerCase())))]
}

export function sentimentLabel(score: number | null) {
  if (score === null) return 'Нет оценки'
  return (score < 5 ? 'Негативная' : score > 5 ? 'Позитивная' : 'Нейтральная') + ' · ' + score + '/10'
}

export type Draft = {
  kind: RequestKind
  sentiment: number
  tags: string[]
  category: string
  title: string
  description: string
  proposal: string
}

export const transitions: Record<RequestStatus, RequestStatus[]> = {
  new: ['review'],
  review: ['in_progress', 'clarification', 'implemented', 'rejected', 'closed'],
  clarification: [],
  in_progress: ['clarification', 'implemented', 'rejected', 'closed'],
  implemented: [],
  rejected: [],
  closed: [],
}

export const terminalStatuses: RequestStatus[] = ['implemented', 'rejected', 'closed']
export const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function feedbackStage(request: { status: RequestStatus; assignee_id: string | null; decision?: string | null }) {
  if (terminalStatuses.includes(request.status)) return request.decision?.trim() ? 'resolved' : 'missingOutcome'
  if (request.status === 'clarification') return 'awaitingAuthor'
  return request.assignee_id ? 'withOwner' : 'routing'
}

export const feedbackStages = {
  routing: 'Нужен ответственный',
  withOwner: 'Следующий шаг за ответственным',
  awaitingAuthor: 'Ожидает ответа автора',
  missingOutcome: 'Закрыто без решения',
  resolved: 'Решение доступно автору',
} as const
