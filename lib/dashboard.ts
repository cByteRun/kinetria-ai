import monthLabels from '../messages/date-months.json'
import { terminalStatuses, type RequestStatus } from './requests'
export const isDone = (r: { status: RequestStatus }) =>
  terminalStatuses.includes(r.status)
export const hasResult = (r: {
  status: RequestStatus
  decision?: string | null
}) => isDone(r) && Boolean(r.decision?.trim())
// Formatters are immutable; share them, but compute today's date on every call.
const dayFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Qyzylorda',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})
const monthFormatter = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'numeric',
  timeZone: 'Asia/Qyzylorda',
})
export function today() {
  return dayFormatter.format(new Date())
}
export const isOverdue = (r: {
  status: RequestStatus
  due_at?: string | null
}) => !isDone(r) && Boolean(r.due_at && r.due_at.slice(0, 10) < today())
// Some browser ICU builds lack Kazakh month names. Numeric calendar parts use
// the same supported locale everywhere; translated month labels are explicit.
const shortMonths: Record<string, readonly string[]> = monthLabels
export function dateLabel(
  value: string | null | undefined,
  locale: string,
  notSet: string,
) {
  if (!value) return notSet
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return notSet
  const parts = monthFormatter.formatToParts(date)
  const day = parts.find((part) => part.type === 'day')!.value
  const month = Number(parts.find((part) => part.type === 'month')!.value) - 1
  const label = (shortMonths[locale] || shortMonths.ru)[month]
  return locale === 'en' ? `${label} ${day}` : `${day} ${label}`
}
