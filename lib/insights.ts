import { hasResult, isOverdue } from './dashboard'
import { topicTags } from './requests'

export type Signal = {
  id: string
  priority?: string
  category_id: string
  kind: string
  tags?: string[]
  status: Parameters<typeof hasResult>[0]['status']
  decision?: string | null
  due_at?: string | null
}
export const normalizeTopic = (value: string) =>
  value
    .trim()
    .toLocaleLowerCase()
    .replaceAll('ё', 'е')
    .replace(/\s+/g, ' ')

// Explicit, explainable grouping; a shared tag is a signal, not proof of duplication.
export function recurringProblems<T extends Signal>(rows: T[]) {
  const seen = new Set<string>()
  const groups = new Map<
    string,
    { category: string; tag: string; rows: T[] }
  >()
  for (const row of rows.filter((r) => r.kind === 'problem')) {
    if (seen.has(row.id)) continue
    seen.add(row.id)
    const tags = [
      ...new Set(topicTags(row.tags || []).map(normalizeTopic)),
    ]
    for (const tag of tags) {
      const key = JSON.stringify([row.category_id, tag])
      const group = groups.get(key) || {
        category: row.category_id,
        tag,
        rows: [],
      }
      group.rows.push(row)
      groups.set(key, group)
    }
  }
  return [...groups.values()]
    .filter((g) => g.rows.length >= 2)
    .map((g) => ({
      ...g,
      results: g.rows.filter(hasResult).length,
      overdue: g.rows.filter(isOverdue).length,
      priority: Math.max(...g.rows.map(priorityRank)),
    }))
    .sort(
      (a, b) =>
        b.rows.length - a.rows.length ||
        b.priority - a.priority ||
        a.tag.localeCompare(b.tag) ||
        a.category.localeCompare(b.category),
    )
}

export const priorityRank = (row: { priority?: string }) =>
  row.priority === 'high' ? 2 : row.priority === 'low' ? 0 : 1

// Count each request once even when it belongs to several thematic groups.
export function recurrenceSummary<T extends Signal>(rows: T[]) {
  const groups = recurringProblems(rows)
  const repeated = new Set(groups.flatMap((g) => g.rows.map((r) => r.id)))
  const problems = [
    ...new Map(
      rows.filter((r) => r.kind === 'problem').map((r) => [r.id, r]),
    ).values(),
  ]
  const recurring = problems.filter((r) => repeated.has(r.id))
  return {
    groups,
    problems: problems.length,
    recurring: recurring.length,
    single: problems.length - recurring.length,
    results: recurring.filter(hasResult).length,
    overdue: recurring.filter(isOverdue).length,
    open: recurring.filter((r) => !hasResult(r)).length,
  }
}

export function prioritizeRequests<T extends Signal>(
  rows: T[],
  byRecurrence = true,
) {
  const counts = new Map<string, number>()
  if (byRecurrence)
    for (const group of recurringProblems(rows)) {
      for (const row of group.rows)
        counts.set(
          row.id,
          Math.max(counts.get(row.id) || 0, group.rows.length),
        )
    }
  return [...rows].sort(
    (a, b) =>
      (counts.get(b.id) || 0) - (counts.get(a.id) || 0) ||
      priorityRank(b) - priorityRank(a) ||
      Number(isOverdue(b)) - Number(isOverdue(a)),
  )
}
