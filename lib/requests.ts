export const statuses = [
  'new',
  'review',
  'clarification',
  'in_progress',
  'implemented',
  'rejected',
  'closed',
] as const

export type RequestStatus = (typeof statuses)[number]
export type Category = {
  id: string
  name_ru: string
  name_en: string
  name_kk: string
}
export const requestKinds = ['problem', 'idea', 'praise'] as const
export type RequestKind = (typeof requestKinds)[number]
export const requestKindLabels = {
  problem: 'problem',
  idea: 'idea',
  praise: 'praise',
} as const

const typeTags = new Set([
  'проблема',
  'пожелание',
  'идея',
  'отзыв',
  'problem',
  'issue',
  'idea',
  'suggestion',
  'wish',
  'praise',
  'мәселе',
  'ұсыныс',
  'тілек',
  'пікір',
])

export function topicTags(tags: string[]) {
  return [
    ...new Set(
      tags
        .map((tag) => tag.trim())
        .filter((tag) => tag && !typeTags.has(tag.toLowerCase())),
    ),
  ]
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

export const terminalStatuses: RequestStatus[] = [
  'implemented',
  'rejected',
  'closed',
]
export const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function feedbackStage(request: {
  status: RequestStatus
  assignee_id: string | null
  decision?: string | null
}) {
  if (terminalStatuses.includes(request.status))
    return request.decision?.trim() ? 'resolved' : 'missingOutcome'
  if (request.status === 'clarification') return 'awaitingAuthor'
  return request.assignee_id ? 'withOwner' : 'routing'
}

// Visual progress is monotonic by status, independent of skipped event history.
export function requestProgressIndex(status: RequestStatus) {
  return terminalStatuses.includes(status) ? 4 :
    ['new', 'review', 'clarification', 'in_progress'].indexOf(status)
}
