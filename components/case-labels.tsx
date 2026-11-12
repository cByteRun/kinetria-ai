import { AlertTriangle, ArrowDownRight, Check, CircleDashed, Clock3, Eye, Folder, GitBranch, Lightbulb, MessageCircle, UserCheck, X } from 'lucide-react'
import { requestKindLabels, type RequestStatus } from '../lib/requests'

const kindIcons = { problem: AlertTriangle, idea: Lightbulb, praise: MessageCircle }
const statusIcons = {
  new: CircleDashed, review: Eye, clarification: MessageCircle,
  in_progress: Clock3, implemented: Check, rejected: X, closed: Folder,
}

export function CaseKind({ kind }: { kind: keyof typeof requestKindLabels }) {
  const Icon = kindIcons[kind]
  return <span className={'case-chip kind-' + kind}><Icon size={14} aria-hidden="true" />{requestKindLabels[kind]}</span>
}

export function CaseStatus({ status, label }: { status: RequestStatus; label: string }) {
  const Icon = statusIcons[status]
  return <span className={'crm-status status-' + status}><Icon size={14} aria-hidden="true" />{label}</span>
}

export function CaseCategory({ name }: { name: string }) {
  return <span className="case-category"><Folder size={15} aria-hidden="true" />{name}</span>
}

export function CaseAssignment({ assigned, closed }: { assigned: boolean; closed: boolean }) {
  const Icon = assigned ? UserCheck : GitBranch
  return <span className={'case-assignment' + (!assigned && !closed ? ' case-needs-owner' : '')}>
    <Icon size={15} aria-hidden="true" />
    {assigned ? 'Назначен' : closed ? 'Без назначения' : 'Резервная очередь'}
  </span>
}

export function CaseNextStep({ children }: { children: string }) {
  return <span className="case-next-step"><ArrowDownRight size={14} aria-hidden="true" />{children}</span>
}
