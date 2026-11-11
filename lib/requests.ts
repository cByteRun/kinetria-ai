export const statuses = ['new', 'review', 'clarification', 'in_progress', 'implemented', 'rejected', 'closed'] as const

export type RequestStatus = (typeof statuses)[number]
export type Category = { id: string; name_ru: string; name_en: string; name_kk: string }
export type Draft = {
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
