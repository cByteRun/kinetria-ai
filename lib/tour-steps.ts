export const TOUR_COMPLETED_KEY = 'idearoute_tour_completed'

/** Routes document the corresponding live screens; tour actions use an isolated fixture. */
export const tourStepsConfig = [
  { id: 'welcome', role: 'text090', route: '/workspace', selectors: ['[data-tour="start"]', '.header-primary', '#workspace-navigation', '.mobile-tabs'], action: 'start', title: 'text091', text: 'text092' },
  { id: 'compose', role: 'text051', route: '/workspace/employee?view=new', selectors: ['[data-tour="compose"]'], action: 'draft', title: 'text093', text: 'text094' },
  { id: 'register', role: 'text051', route: '/workspace/employee?view=new', selectors: ['[data-tour="draft"]', '[data-tour="register"]'], action: 'register', title: 'text095', text: 'text096' },
  { id: 'route', role: 'text097', route: '/workspace/manager?view=registry', selectors: ['[data-tour="summary"]'], action: 'manager', title: 'text098', text: 'text099' },
  { id: 'assign', role: 'text100', route: '/workspace/manager?view=registry', selectors: ['[data-tour="assignee"]'], action: 'assign', title: 'text101', text: 'text102' },
  { id: 'resolve', role: 'text103', route: '/workspace/handler?view=registry', selectors: ['[data-tour="resolution"]'], action: 'resolve', title: 'text104', text: 'text105' },
  { id: 'insights', role: 'text106', route: '/workspace/admin?view=insights', selectors: ['[data-tour="insights"]', '[data-tour="qvin"]'], action: 'insights', title: 'text107', text: 'text108' },
  { id: 'finish', role: 'text109', route: '/workspace?view=help', selectors: [], action: 'finish', title: 'text110', text: 'text111' },
] as const


export type TourRole = 'admin' | 'manager' | 'employee' | 'handler'
export function tourRoleFromPath(path: string): TourRole | null {
  const role = path.split(/[?#]/)[0].split('/')[2]
  return path.startsWith('/workspace/') && ['admin', 'manager', 'employee', 'handler'].includes(role) ? role as TourRole : null
}

/** Context steps only target the current role's live Overview. No fixture or cross-role actions. */
export function generateTourSteps(currentRole: TourRole | null, currentRoute: string) {
  if (!currentRole || tourRoleFromPath(currentRoute) !== currentRole) return []
  const step = (id: string, target: string, fallback?: string) => ({
    id, selector: `[data-tour="${target}"]`, fallback: fallback ? `[data-tour="${fallback}"]` : undefined,
    title: `context.${currentRole}.${id}Title`, text: `context.${currentRole}.${id}Text`,
  })
  return [
    step('welcome', 'start'),
    step('pulse', 'overview-pulse'),
    step('queue', currentRole === 'employee' ? 'overview-create' : 'overview-metrics'),
    step('route', 'overview-route'),
    step('focus', 'overview-focus', 'overview-metrics'),
    step('finish', 'overview-results', 'overview-route'),
  ]
}
