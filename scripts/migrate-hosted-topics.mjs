// One-off production repair. Run with the Vercel integration environment.
// The pg dependency is installed separately, outside the application package.
import { readFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'

const version = '20261113021538'
const name = 'registry_topics'
const ref = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname.split('.')[0]
if (ref !== '<ENV_VALUE>') throw new Error('Database target mismatch')
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
    const existing = await client.query("select to_regclass('public.topics') as topics")
    if (existing.rows[0].topics) throw new Error('Partial migration requires inspection')
    const sql = await readFile(`supabase/migrations/${version}_${name}.sql`, 'utf8')
    await client.query(sql)
    await client.query('insert into supabase_migrations.schema_migrations(version,name,statements) values($1,$2,$3)', [version, name, [sql]])
    console.log('Applied migration:', version + '_' + name)
  } else console.log('Migration already applied:', version)
  const before = Number((await client.query('select count(*) as n from public.requests')).rows[0].n)
  const seededBefore = Number((await client.query("select count(*) as n from public.requests where source_ref like 'SYN-%'")).rows[0].n)
  const seed = (await readFile('supabase/demo-topics.sql', 'utf8')).replace(/^begin;\s*/im, '').replace(/commit;\s*$/i, '')
  await client.query(seed)
  const state = (await client.query(`select
    (select count(*)::int from public.requests) as requests,
    (select count(*)::int from public.requests where source_ref like 'SYN-%') as synthetic,
    (select count(*)::int from pg_class where oid in ('public.topics'::regclass,'public.topic_requests'::regclass) and relrowsecurity) as rls_tables,
    has_function_privilege('anon','public.topic_service(text,jsonb)','execute') as anon_rpc,
    has_function_privilege('authenticated','public.topic_service(text,jsonb)','execute') as user_rpc`)).rows[0]
  if (state.synthetic !== 40 || state.requests !== before + 40 - seededBefore || state.rls_tables !== 2 || state.anon_rpc || !state.user_rpc) throw new Error('Migration permissions verification failed')
  console.log('Verified hosted topics:', JSON.stringify(state))
  await client.query("notify pgrst, 'reload schema'")
  await client.query('commit')
  console.log('Topics migration and 40 synthetic requests committed; existing requests preserved')
} catch (error) {
  if (client) await client.query('rollback').catch(() => {})
  const safe = ['Database target mismatch', 'No matching database connection available', 'Partial migration requires inspection', 'Migration permissions verification failed']
  console.error('Topics migration failed:', safe.includes(error.message) ? error.message : error.code || 'configuration/connection error')
  process.exitCode = 1
} finally {
  if (client) await client.end()
}
