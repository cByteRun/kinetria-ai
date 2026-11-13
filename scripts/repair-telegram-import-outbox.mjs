// Dry run by default. Completes only historical dataset creation notifications.
// Does not call Telegram or change requests, events, links or real submissions.
import { createClient } from '@supabase/supabase-js'
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})
const { data, error } = await db.from('requests').select('id')
  .eq('is_demo', true).or('source_ref.match.^A-[0-9]+$,source_ref.match.^SYN-[0-9]+-[0-9]+$')
if (error) throw new Error('Cannot inspect imported requests: ' + error.code)
const ids = data.map(r => r.id)
if (!ids.length) { console.log('No imported requests'); process.exit(0) }
const pending = () => db.from('telegram_outbox').select('id', { count: 'exact', head: true })
  .in('request_id', ids).eq('event', 'created').eq('done', false)
const before = await pending()
if (before.error) throw new Error('Cannot inspect outbox: ' + before.error.code)
console.log('Pending import creation notifications:', before.count)
if (process.argv.includes('--apply')) {
  const { data: fixed, error } = await db.from('telegram_outbox')
    .update({ done: true, leased_until: null }).in('request_id', ids)
    .eq('event', 'created').eq('done', false)
    .or(`leased_until.is.null,leased_until.lt.${new Date().toISOString()}`).select('id')
  if (error) throw new Error('Cannot complete import notifications: ' + error.code)
  const after = await pending()
  if (after.error) throw new Error('Cannot verify repair: ' + after.error.code)
  console.log('Completed import notifications:', fixed.length, '; remaining:', after.count)
  if (after.count) throw new Error('Import notifications remain; inspect active delivery leases')
} else console.log('Dry run; pass --apply to complete these notifications without sending')
