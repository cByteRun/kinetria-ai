export type Status = 'draft' | 'routing' | 'in_progress' | 'clarification' | 'resolved' | 'closed';

export type Role = 'employee' | 'responsible' | 'manager' | 'admin';

export interface HistoryEvent {
  at: string;
  text: string;
}

export interface Request {
  id: string;
  title: string;
  body: string;
  author: string;
  category: string;
  channel: 'web' | 'telegram';
  status: Status;
  assignee: string | null;
  due: string | null;
  question: string | null;
  answer: string | null;
  decision: string | null;
  history: HistoryEvent[];
}

export const TODAY = '2026-11-12';

export const STAGES = ['stageCreated', 'stageAssigned', 'stageResolved', 'stageReceived'] as const;

export const STATUS_META: Record<
  Status,
  { label: string; dot: string; badge: string; progress: number }
> = {
  draft: {
    label: 'meta0',
    dot: 'bg-slate-500',
    badge: 'bg-slate-100 text-slate-700 ring-slate-200',
    progress: 1,
  },
  routing: {
    label: 'meta1',
    dot: 'bg-amber-600',
    badge: 'bg-amber-50 text-amber-800 ring-amber-200',
    progress: 1,
  },
  in_progress: {
    label: 'meta2',
    dot: 'bg-amber-600',
    badge: 'bg-amber-50 text-amber-800 ring-amber-200',
    progress: 2,
  },
  clarification: {
    label: 'meta3',
    dot: 'bg-violet-600',
    badge: 'bg-violet-50 text-violet-800 ring-violet-200',
    progress: 2,
  },
  resolved: {
    label: 'meta4',
    dot: 'bg-brand-600',
    badge: 'bg-brand-50 text-brand-700 ring-brand-200',
    progress: 3,
  },
  closed: {
    label: 'meta5',
    dot: 'bg-emerald-600',
    badge: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
    progress: 4,
  },
};

export const ROLE_META: Record<Role, { label: string; user: string; hint: string }> = {
  employee: {
    label: 'meta6',
    user: 'meta7',
    hint: 'meta8',
  },
  responsible: {
    label: 'meta9',
    user: 'meta10',
    hint: 'meta11',
  },
  manager: {
    label: 'meta12',
    user: 'meta13',
    hint: 'meta14',
  },
  admin: {
    label: 'meta15',
    user: 'meta16',
    hint: 'meta17',
  },
};

export const ROLE_ORDER: Role[] = ['employee', 'responsible', 'manager', 'admin'];

