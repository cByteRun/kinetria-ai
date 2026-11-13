import type { TopicInput } from './semantic-topics'
export type SavedTopic = {
 id: string; title: string; description: string | null; isAiGenerated: boolean;
 createdBy: string; creatorRole: string; createdAt: string; ticketIds: string[]
}
export type TopicDraft = Pick<SavedTopic, 'id' | 'title' | 'ticketIds' | 'isAiGenerated'> & { description?: string }
export type TopicRow = TopicInput & { number: number; category_id: string; tags: string[]; kind: string; status: import('./requests').RequestStatus }
