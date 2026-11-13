// All credentials come from the local CLI, never from .env.local or a hosted project.
const {execFileSync}=require('node:child_process')
const {readFileSync}=require('node:fs')
const {resolve}=require('node:path')
const assert=require('node:assert/strict')
const cli=process.env.SUPABASE_CLI||resolve('node_modules/.bin/supabase')
const args=process.env.SUPABASE_WORKDIR?['--workdir',process.env.SUPABASE_WORKDIR]:[]
const config=JSON.parse(execFileSync(cli,[...args,'status','-o','json'],{encoding:'utf8',stdio:['ignore','pipe','pipe']}))
for(const key of ['API_URL','DB_URL'])assert(['localhost','127.0.0.1'].includes(new URL(config[key]).hostname),'Tests require isolated local Supabase')
const env={...process.env,NEXT_PUBLIC_SUPABASE_URL:config.API_URL,NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:config.ANON_KEY,SUPABASE_SECRET_KEY:config.SERVICE_ROLE_KEY,KINETRIA_DEMO_PASSWORD:process.env.LOCAL_TEST_DEMO_PASSWORD||'Local-ci-demo-123!'}
execFileSync(process.execPath,['scripts/seed-demo.mjs'],{env,stdio:'inherit'})
const workdir=process.env.SUPABASE_WORKDIR||process.cwd()
const project=readFileSync(resolve(workdir,'supabase/config.toml'),'utf8').match(/^project_id\s*=\s*"([\w-]+)"/m)?.[1]
assert(project,'Missing local project_id')
function sql(file){
  console.log('SQL:',file)
  execFileSync('docker',['exec','-i',`supabase_db_${project}`,'psql','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1','-f','-'],{input:readFileSync(file),stdio:['pipe','inherit','inherit']})
}
// Fixtures are synthetic and retained only in this local test database.
sql('supabase/demo-data.sql')
sql('supabase/demo-routing.sql')
for(const file of ['scripts/check-category-i18n.sql','scripts/check-telegram.sql','scripts/check-telegram-demo.sql','scripts/sql/check-client-feedback.sql'])sql(file)
console.log('PASS local database integration/RLS')
