import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { readFile } from 'node:fs/promises'
const require = createRequire(import.meta.url), ts = require('typescript')
const moduleUrl = source => 'data:text/javascript;base64,' + Buffer.from(source).toString('base64')
const source = await readFile(new URL('../lib/auth-flow.ts', import.meta.url), 'utf8')
const imports = {
  'next/headers': 'export const cookies = async () => globalThis.authTest.jar',
  './roles': "export const isRole = value => ['employee','manager','handler','admin','client'].includes(value); export const roles = {}",
  './demo-accounts.json': 'export default []',
  './session': "export const demoCookie='kinetria_demo', localPreview=false; export const startPreview=async()=>{}",
  './supabase/config': 'export const hasSupabase=true',
  './supabase/server': 'export const createClient=async(timeout)=>{ globalThis.authTest.timeout=timeout; return globalThis.authTest.client }',
}
let compiled = ts.transpileModule(source, {compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText
for(const [name, stub] of Object.entries(imports)) compiled = compiled.replaceAll(`from '${name}'`, `from '${moduleUrl(stub)}'`).replaceAll(`from "${name}"`, `from '${moduleUrl(stub)}'`)
const { endSession, authenticate } = await import(moduleUrl(compiled))
const originalUrl=process.env.NEXT_PUBLIC_SUPABASE_URL
process.env.NEXT_PUBLIC_SUPABASE_URL='https://testproject.supabase.co'
try {
  for(const failure of ['throw','error','success']) {
    const deleted=[], state={timeout:0,jar:{getAll:()=>['sb-testproject-auth-token.0','sb-testproject-auth-token.1','sb-testproject-auth-token-code-verifier','kinetria_theme','another-project-cookie'].map(name=>({name})),delete:name=>deleted.push(name)},client:{auth:{signOut:async(options)=>{assert.equal(options.scope,'local');if(failure==='throw')throw new Error('network unavailable');return {error:failure==='error'?new Error('remote failure'):null}}}}}
    globalThis.authTest=state
    assert.equal(await endSession(),'/login')
    assert.equal(state.timeout,5000)
    assert.deepEqual(deleted,['sb-testproject-auth-token.0','sb-testproject-auth-token.1','sb-testproject-auth-token-code-verifier','kinetria_demo'])
    console.log('PASS logout removes current session only:',failure)
  }
  let called=false
  globalThis.authTest={client:{auth:{signInWithPassword:async()=>{called=true;throw Error('must not authenticate')}}}}
  const invalid=new FormData();invalid.set('role','superadmin');assert.equal(await authenticate(invalid),'/login?error=credentials');assert.equal(called,false)
  console.log('PASS invalid role rejected before authentication')
  for (const [role, view] of [['employee','new'],['manager','registry'],['handler','registry'],['admin','routing'],['client','overview']]) {
    globalThis.authTest={client:{auth:{signInWithPassword:async()=>({data:{user:{id:'synthetic-user'}},error:null})},from:()=>({select:()=>({eq:()=>({eq:()=>({maybeSingle:async()=>({data:{role},error:null})})})})})}}
    const form=new FormData();form.set('email','synthetic@example.test');form.set('password','synthetic')
    assert.equal(await authenticate(form),`/workspace/${role}?view=${view}`)
    console.log('PASS authenticated profile opens relevant section:',role,view)
    for (const intent of ['https://untrusted.example/', 'new', 'registry', 'results', 'analytics', 'routing']) {
      form.set('intent', intent)
      const available={employee:['new','registry','results'],manager:['registry','analytics','results'],handler:['registry','results','analytics'],admin:['routing','analytics','registry'],client:['overview']}[role]
      const expected=available.includes(intent)?intent:view
      assert.equal(await authenticate(form),`/workspace/${role}?view=${expected}`)
    }
    console.log('PASS allowed intents and forbidden sections:',role)
  }

}finally{delete globalThis.authTest;if(originalUrl===undefined)delete process.env.NEXT_PUBLIC_SUPABASE_URL;else process.env.NEXT_PUBLIC_SUPABASE_URL=originalUrl}
