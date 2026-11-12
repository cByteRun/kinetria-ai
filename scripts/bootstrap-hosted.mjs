// One-off deployment bootstrap; never part of the regular application build.
// Uses the PostgreSQL URL supplied by the Vercel Supabase integration.
import { readFile, readdir } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
import { spawnSync } from 'node:child_process'
const expectedRef = process.env.NEXT_PUBLIC_SUPABASE_URL && new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname.split('.')[0]
const connectionString = process.env.POSTGRES_URL_NON_POOLING || process.env.POSTGRES_URL
if (!connectionString || !expectedRef) throw new Error('PostgreSQL integration URL and Supabase API URL are required')
const connectionUrl = new URL(connectionString)
// A Supabase pooler identifies the project in the postgres.<ref> username.
if (!connectionUrl.hostname.includes(expectedRef) && !decodeURIComponent(connectionUrl.username).endsWith('.' + expectedRef)) throw new Error('PostgreSQL and API project IDs differ; refusing migration')
const modulePath = process.env.BOOTSTRAP_PG_MODULE || '/tmp/idearoute-db/node_modules/pg/lib/index.js'
const { default: pg } = await import(pathToFileURL(modulePath).href)
const certificate = await fetch('https://supabase-downloads.s3-ap-southeast-1.amazonaws.com/prod/ssl/prod-ca-2021.crt', {signal:AbortSignal.timeout(15000)})
if(!certificate.ok)throw new Error('Supabase CA certificate unavailable')
const ca=await certificate.text()
if(!ca.includes('-----BEGIN CERTIFICATE-----'))throw new Error('Invalid CA certificate')
for(const key of ['sslmode','sslcert','sslkey','sslrootcert'])connectionUrl.searchParams.delete(key)
const client = new pg.Client({ connectionString:connectionUrl.href, ssl:{ca,rejectUnauthorized:true}, connectionTimeoutMillis: 15000 })
await client.connect()
try {
 await client.query('select pg_advisory_lock(872031104)')
 await client.query('create schema if not exists supabase_migrations')
 await client.query('create table if not exists supabase_migrations.schema_migrations (version text primary key, statements text[], name text)')
 const applied = new Set((await client.query('select version from supabase_migrations.schema_migrations')).rows.map(r=>r.version))
 for (const file of (await readdir('supabase/migrations')).filter(x=>/^\d+_.*\.sql$/.test(x)).sort()) {
  const [version, ...name] = file.slice(0,-4).split('_')
  if (applied.has(version)) continue
  const sql = await readFile('supabase/migrations/' + file,'utf8')
  await client.query('begin')
  try {
   await client.query(sql)
   await client.query('insert into supabase_migrations.schema_migrations(version,name,statements) values($1,$2,$3)',[version,name.join('_'),[sql]])
   await client.query('commit')
   console.log('Applied migration ' + file)
  } catch (error) { await client.query('rollback'); throw error }
 }
 await client.query("notify pgrst, 'reload schema'")
 // Wait briefly for the Data API schema reload before provisioning Auth profiles.
 let ready = false
 for (let i=0;i<15;i++) {
  const r=await fetch(process.env.NEXT_PUBLIC_SUPABASE_URL+'/rest/v1/profiles?select=id&limit=0',{headers:{apikey:process.env.SUPABASE_SECRET_KEY},signal:AbortSignal.timeout(8000)})
  if(r.ok){ready=true;break}
  await new Promise(resolve=>setTimeout(resolve,1000))
 }
 if(!ready)throw new Error('Data API schema reload not ready')
 const seed=spawnSync(process.execPath,['scripts/seed-demo.mjs'],{stdio:'inherit',env:process.env})
 if(seed.status!==0)throw new Error('Demo account provisioning failed')
 for(const file of ['supabase/demo-data.sql','supabase/demo-routing.sql']) {
  await client.query(await readFile(file,'utf8'))
  console.log('Applied '+file)
 }
 const result=await client.query('select (select count(*) from public.profiles)::int as profiles,(select count(*) from public.requests)::int as requests')
 console.log('Bootstrap verified: '+JSON.stringify(result.rows[0]))
} catch(error) {
 // Do not print connection strings, stack traces or database user data.
 console.error('Hosted bootstrap failed:',error.code || 'configuration/connection error')
 process.exitCode=1
} finally {
 await client.query('select pg_advisory_unlock(872031104)').catch(()=>{})
 await client.end()
}
