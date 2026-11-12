import { terminalStatuses, type RequestStatus } from './requests'
export const statusNames: Record<RequestStatus, string> = {
  new: 'Новое',
  review: 'На рассмотрении',
  clarification: 'Ожидает уточнения',
  in_progress: 'В работе',
  implemented: 'Реализовано',
  rejected: 'Отклонено',
  closed: 'Закрыто',
}
export const isDone = (r: { status: RequestStatus }) =>
  terminalStatuses.includes(r.status)
export const hasResult = (r: {
  status: RequestStatus
  decision?: string | null
}) => isDone(r) && Boolean(r.decision?.trim())
export function today() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Qyzylorda',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}
export const isOverdue = (r: {
  status: RequestStatus
  due_at?: string | null
}) => !isDone(r) && Boolean(r.due_at && r.due_at.slice(0, 10) < today())
export function dateLabel(value?: string | null) {
  return value
    ? new Date(value).toLocaleDateString('ru-RU', {
        day: 'numeric',
        month: 'short',
        timeZone: 'Asia/Qyzylorda',
      })
    : 'Не задан'
}
