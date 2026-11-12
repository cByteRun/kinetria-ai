// One-off production repair. Run with the Vercel integration environment.
// The pg dependency is installed separately, outside the application package.
import { readFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'

const version = '20261112181447'
const name = 'telegram_async_inbox'
const ref = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname.split('.')[0]
const { default: pg } = await import(pathToFileURL(process.env.MIGRATION_PG_MODULE || '/tmp/idearoute-migration/node_modules/pg/lib/index.js').href)
const certificate = await fetch('https://supabase-downloads.s3-ap-southeast-1.amazonaws.com/prod/ssl/prod-ca-2021.crt', { signal: AbortSignal.timeout(15000) })
if (!certificate.ok) throw new Error('Supabase CA unavailable')
const ca = await certificate.text()
if (!ca.includes('-----BEGIN CERTIFICATE-----')) throw new Error('Invalid CA')

let client
try {
  for (const raw of [...new Set([process.env.POSTGRES_URL_NON_POOLING, process.env.POSTGRES_URL].filter(Boolean))]) {
    const url = new URL(raw)
    if (url.hostname !== `db.${ref}.supabase.co` && decodeURIComponent(url.username) !== `postgres.${ref}`) throw new Error('Database target mismatch')
    for (const key of ['sslmode', 'sslcert', 'sslkey', 'sslrootcert']) url.searchParams.delete(key)
    const candidate = new pg.Client({ connectionString: url.href, ssl: { ca, rejectUnauthorized: true }, connectionTimeoutMillis: 15000 })
    try { await candidate.connect(); client = candidate; break }
    catch (error) { await candidate.end().catch(() => {}); console.log('Connection attempt failed:', error.code || 'connection error') }
  }
  if (!client) throw new Error('No matching database connection available')
  await client.query('begin')
  await client.query("set local lock_timeout = '15s'")
  await client.query("set local statement_timeout = '45s'")
  await client.query('select pg_advisory_xact_lock(872031104)')
  const applied = await client.query('select version from supabase_migrations.schema_migrations where version=$1', [version])
  if (!applied.rowCount) {
    const existing = await client.query("select to_regclass('public.telegram_inbox') as inbox, to_regclass('public.telegram_api_limits') as limits")
    if (existing.rows[0].inbox || existing.rows[0].limits) throw new Error('Partial migration requires inspection')
    const sql = await readFile(`supabase/migrations/${version}_${name}.sql`, 'utf8')
    await client.query(sql)
    await client.query('insert into supabase_migrations.schema_migrations(version,name,statements) values($1,$2,$3)', [version, name, [sql]])
    console.log('Applied migration:', version + '_' + name)
  } else console.log('Migration already applied:', version)
  const verification = await client.query(`select
    (select count(*)::int from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname in ('telegram_inbox','telegram_api_limits') and c.relrowsecurity) as rls_tables,
    has_table_privilege('anon','public.telegram_inbox','select') as anon_read,
    has_table_privilege('authenticated','public.telegram_inbox','select') as user_read,
    has_function_privilege('anon','public.telegram_inbox_claim(integer)','execute') as anon_claim,
    has_function_privilege('service_role','public.telegram_enqueue(bigint,bigint,jsonb)','execute') as service_enqueue,
    has_function_privilege('service_role','public.telegram_inbox_claim(integer)','execute') as service_claim,
    has_function_privilege('service_role','public.telegram_inbox_finish(bigint,uuid,boolean)','execute') as service_finish,
    has_function_privilege('service_role','public.telegram_api_slot(text,integer)','execute') as service_slot`)
  const v = verification.rows[0]
  if (v.rls_tables !== 2 || v.anon_read || v.user_read || v.anon_claim || !v.service_enqueue || !v.service_claim || !v.service_finish || !v.service_slot) throw new Error('Migration permissions verification failed')
  await client.query("notify pgrst, 'reload schema'")
  await client.query('commit')
  console.log('Migration committed; tables, RLS and service RPC permissions verified')
} catch (error) {
  if (client) await client.query('rollback').catch(() => {})
  const safe = ['Database target mismatch', 'No matching database connection available', 'Partial migration requires inspection', 'Migration permissions verification failed']
  console.error('Inbox migration failed:', safe.includes(error.message) ? error.message : error.code || 'configuration/connection error')
  process.exitCode = 1
} finally {
  if (client) await client.end()
}
