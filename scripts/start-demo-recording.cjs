// Launch only against the existing isolated LOCAL Supabase; do not print keys.
const {execFileSync,spawn}=require('node:child_process')
const path=require('node:path')
const cli=process.env.SUPABASE_CLI||'supabase'
const config=JSON.parse(execFileSync(cli,['status','-o','json'],{encoding:'utf8',stdio:['ignore','pipe','pipe']}))
if(!['127.0.0.1','localhost'].includes(new URL(config.API_URL).hostname))throw new Error('Local Supabase required')
process.loadEnvFile('.env.local')
const env={...process.env,NEXT_PUBLIC_SUPABASE_URL:config.API_URL,NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:config.ANON_KEY,SUPABASE_SECRET_KEY:config.SERVICE_ROLE_KEY,AI_PROVIDER:'groq',GROQ_API_KEY:'demo-adapter',TELEGRAM_BOT_TOKEN:'',TELEGRAM_CHANNEL_ID:'',DEMO_RECORDING:'true',IDEAROUTE_BUILD_DIR:'.next-demo',NODE_OPTIONS:'--import '+path.resolve('scripts/demo-ai-provider.mjs')}
const child=spawn(process.execPath,['node_modules/next/dist/bin/next','dev','--port','3016'],{stdio:'inherit',env})
for(const signal of ['SIGTERM','SIGINT'])process.on(signal,()=>child.kill(signal))
child.on('exit',code=>process.exit(code||0))
