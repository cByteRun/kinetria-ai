import type { FeedbackRow } from '../feedback'
import type { QvinRow } from '../qvin'
import type { RequestKind, RequestStatus } from '../requests'
import type { Context } from './bot'
export type TelegramEvent = { event_type: string; actor_role: string; created_at: string; message?: string; next_step?: string }
export type TelegramDetail = {
  id: string; number: number; title: string; description: string; status: RequestStatus; kind: RequestKind;
  category_id: string; tags: string[]; proposal: string | null; assignee_id: string | null;
  assignee_name?: string; due_at: string | null; decision: string | null; next_step: string | null;
  acknowledged_at: string | null; version: number; clarification_question?: string;
  files: { id: string; name: string }[]; events: TelegramEvent[]
}
export type BridgeResults = {
  portal: unknown; qvin:QvinRow[];
  context: Context; detail: TelegramDetail;
  history: { id: string; number: number; events: TelegramEvent[]; more: boolean };
  list: TelegramSummary[]; stats: TelegramSummary[]; reserve: TelegramSummary[];
  assignees: { id: string; display_name: string }[];
  file: { name: string; content: string } | null;
  submit: { id: string; number: number };
  claim: boolean | 'busy'; finish: boolean; state: boolean; link: { linked: boolean };
  unlink: boolean; assign: unknown; review: unknown; ack: unknown; comment: unknown
}

export type TelegramSummary = Pick<TelegramDetail, 'id' | 'number' | 'title' | 'status' | 'assignee_id' | 'due_at'> & { created_at: string }

export type PortalRead = FeedbackRow[]
