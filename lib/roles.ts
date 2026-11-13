export const roles = {
  employee: {
    email: 'employee@kinetria.example',
  },
  handler: {
    email: 'handler@kinetria.example',
  },
  manager: {
    email: 'manager@kinetria.example',
  },
  admin: {
    email: 'admin@kinetria.example',
  },
  client: {
    email: 'client@kinetria.example',
  },
} as const

export type Role = keyof typeof roles

export function isRole(value: unknown): value is Role {
  return typeof value === 'string' && Object.hasOwn(roles, value)
}

export const canViewInsights = (role: Role) =>
  role === 'manager' || role === 'handler' || role === 'admin'

// Shared authorization for semantic clustering in API and UI.
export const canGenerateTopics = (role: Role | null) =>
  role === 'admin' || role === 'manager' || role === 'handler'
