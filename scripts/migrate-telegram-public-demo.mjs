// One-off production repair. Run with the Vercel integration environment.
// The pg dependency is installed separately, outside the application package.
import { readFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'

const version = '20261113052320'
const name = 'telegram_public_demo'
const ref = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname.split('.')[0]
if (!process.env.MIGRATION_PROJECT_REF || process.env.MIGRATION_PROJECT_REF !== ref) throw new Error('Database target mismatch')
const { default: pg } = process.env.MIGRATION_PG_MODULE
  ? await import(pathToFileURL(process.env.MIGRATION_PG_MODULE).href)
  : await import('pg')
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
    const sql = await readFile(`supabase/migrations/${version}_${name}.sql`, 'utf8')
    await client.query(sql)
    await client.query('insert into supabase_migrations.schema_migrations(version,name,statements) values($1,$2,$3)', [version, name, [sql]])
    console.log('Applied migration:', version + '_' + name)
  } else console.log('Migration already applied:', version)
  const verification = await client.query(`select
    exists(select 1 from information_schema.columns where table_schema='public' and table_name='telegram_links' and column_name='is_demo') as demo_column,
    exists(select 1 from pg_indexes where schemaname='public' and indexname='telegram_links_real_user_key') as real_unique,
    has_function_privilege('anon','public.telegram_demo_login(bigint,uuid)','execute') as anon_login,
    has_function_privilege('authenticated','public.telegram_demo_login(bigint,uuid)','execute') as user_login,
    has_function_privilege('service_role','public.telegram_demo_login(bigint,uuid)','execute') as service_login`)
  const v = verification.rows[0]
  if (!v.demo_column || !v.real_unique || v.anon_login || v.user_login || !v.service_login) throw new Error('Migration permissions verification failed')
  await client.query("notify pgrst, 'reload schema'")
  await client.query('commit')
  console.log('Migration committed; demo column, real account uniqueness and service RPC permissions verified')
  const test = (await readFile('scripts/check-telegram-demo.sql', 'utf8')).replace('\\set ON_ERROR_STOP on', '')
  await client.query(test)
  console.log('PASS hosted rollback test: concurrent demo viewers, isolated drafts, real account uniqueness and role guards')
} catch (error) {
  if (client) await client.query('rollback').catch(() => {})
  const safe = ['Database target mismatch', 'No matching database connection available', 'Partial migration requires inspection', 'Migration permissions verification failed']
  console.error('Public demo migration failed:', safe.includes(error.message) ? error.message : error.code || 'configuration/connection error')
  process.exitCode = 1
} finally {
  if (client) await client.end()
}
