import { hasResult, isOverdue } from './dashboard'
import { topicTags } from './requests'

type Signal = {
  category_id: string
  kind: string
  tags?: string[]
  status: Parameters<typeof hasResult>[0]['status']
  decision?: string | null
  due_at?: string | null
}
export const normalizeTopic = (value: string) =>
  value.trim().toLocaleLowerCase().replaceAll('ё', 'е').replace(/\s+/g, ' ')

// Explicit, explainable grouping; a shared tag is a signal, not proof of duplication.
export function recurringProblems<T extends Signal>(rows: T[]) {
  const groups = new Map<string, { category: string; tag: string; rows: T[] }>()
  for (const row of rows.filter(r => r.kind === 'problem')) {
    const tags = [...new Set(topicTags(row.tags || []).map(normalizeTopic))]
    for (const tag of tags) {
      const key = JSON.stringify([row.category_id, tag])
      const group = groups.get(key) || { category: row.category_id, tag, rows: [] }
      group.rows.push(row)
      groups.set(key, group)
    }
  }
  return [...groups.values()].filter(g => g.rows.length >= 2)
    .map(g => ({ ...g, results: g.rows.filter(hasResult).length, overdue: g.rows.filter(isOverdue).length }))
    .sort((a, b) => b.rows.length - a.rows.length || a.tag.localeCompare(b.tag))
}
