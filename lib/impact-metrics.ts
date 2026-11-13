export type ImpactMetrics = {
  hours_per_month: number | null
  monthly_value: number | null
  currency: string | null
  basis: string
}

export function parseImpactMetrics(value: unknown): ImpactMetrics {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid metrics')
  const v = value as Record<string, unknown>
  for (const [key, max] of [['hours_per_month', 100000], ['monthly_value', 1e12]] as const) {
    if (v[key] !== null && (typeof v[key] !== 'number' || !Number.isFinite(v[key]) || v[key] < 0 || v[key] > max)) throw new Error('Invalid number')
  }
  if (v.currency !== null && (typeof v.currency !== 'string' || !/^[A-Z]{3}$/.test(v.currency))) throw new Error('Invalid currency')
  if (typeof v.basis !== 'string' || v.basis.length > 4000 || ((v.hours_per_month !== null || v.monthly_value !== null) && !v.basis.trim()) || (v.monthly_value !== null && !v.currency)) throw new Error('Missing basis')
  return { hours_per_month: v.hours_per_month as number | null, monthly_value: v.monthly_value as number | null, currency: v.currency as string | null, basis: v.basis.trim() }
}
