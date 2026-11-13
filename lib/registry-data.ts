import type { SupabaseClient } from '@supabase/supabase-js'
import type { RegistryRow } from '../components/request-registry'

const columns = 'id,number,source_ref,category_id,title,status,assignee_id,kind,sentiment,description,next_step,decision,updated_at,created_at,due_at,department,priority,first_response_at,resolved_at,acknowledged_at,is_demo,version,tags'

export async function readRegistry(db: Pick<SupabaseClient, 'from'>) {
  const read = (withOrigin: boolean) => db.from('requests')
    .select(withOrigin ? columns + ',origin' : columns)
    .order('created_at', { ascending: false }).order('id').returns<RegistryRow[]>()
  const result = await read(true)
  // New application code can reach an environment before its additive migration.
  // Only retry a missing-origin schema error; auth/network errors stay visible.
  if (result.error && ['42703', 'PGRST204'].includes(result.error.code) && result.error.message.includes('origin')) {
    return read(false)
  }
  return result
}
