export type FeedbackRow = {
 id:string; request_id:string|null; own:boolean; origin:'employee'|'client'; title:string; description:string; public_title:string; public_description:string;
 status:'review'|'in_progress'|'implemented'|'closed'; response:string; published:boolean; version:number; created_at:string; votes:number; supported:boolean; can_manage:boolean
}
