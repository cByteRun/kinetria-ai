const {execFileSync,spawn}=require('node:child_process')
const {resolve}=require('node:path')
process.loadEnvFile('.env.local')
const config=JSON.parse(execFileSync(process.env.SUPABASE_CLI||'supabase',['status','-o','json'],{encoding:'utf8',stdio:['ignore','pipe','pipe']}))
if(!['localhost','127.0.0.1'].includes(new URL(config.API_URL).hostname))throw new Error('Mobile tests require isolated local Supabase')
const env={...process.env,NEXT_PUBLIC_SUPABASE_URL:config.API_URL,NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:config.ANON_KEY,SUPABASE_SECRET_KEY:config.SERVICE_ROLE_KEY,AI_PROVIDER:'groq',GROQ_API_KEY:'local-mock-only',TELEGRAM_BOT_TOKEN:'',TELEGRAM_CHANNEL_ID:'',IDEAROUTE_BUILD_DIR:'.next-mobile-test',NODE_OPTIONS:'--import '+resolve('scripts/mobile-ai-provider.mjs')}
const child=spawn(process.execPath,['node_modules/next/dist/bin/next','dev','--port',process.env.MOBILE_TEST_PORT||'3012'],{stdio:'inherit',env})
process.on('SIGTERM',()=>child.kill());process.on('SIGINT',()=>child.kill());child.on('exit',code=>process.exit(code||0))
