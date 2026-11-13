import {readFile, mkdir, writeFile} from 'node:fs/promises'
import {execFileSync} from 'node:child_process'
import {createRequire} from 'node:module'
import assert from 'node:assert/strict'
const baseline = process.env.PERF_BASE_REF || 'a03946b'
const root=process.cwd(), require=createRequire(root+'/package.json'), ts=require('typescript')
async function moduleUrl(name,before){
 let source=before?execFileSync('git',['show',`${baseline}:lib/${name}.ts`],{encoding:'utf8'}):await readFile(`${root}/lib/${name}.ts`,'utf8')
 for(const match of [...source.matchAll(/import (\w+) from '([^']+\.json)'/g)])source=source.replace(match[0],`const ${match[1]} = ${await readFile(new URL(match[2],`file://${root}/lib/${name}.ts`),'utf8')}`)
 for(const match of [...source.matchAll(/from '(\.\/[^']+)'/g)])source=source.replace(match[0],`from '${await moduleUrl(match[1].slice(2),before)}'`)
 return 'data:text/javascript;base64,'+Buffer.from(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText).toString('base64')
}
const rows=Array.from({length:1000},(_,i)=>({id:String(i),kind:'problem',category_id:'catalog',priority:'normal',status:'new',due_at:i%2?'2020-01-01':'2099-01-01',tags:[]}))
const report={rows:rows.length,runs:5,results:[]};let expected
for(const before of [true,false]){
 const {prioritizeRequests}=await import(await moduleUrl('insights',before));const samples=[]
 for(let i=0;i<5;i++){const start=performance.now();const sorted=prioritizeRequests(rows,false);samples.push(performance.now()-start);if(!expected)expected=sorted.map(r=>r.id);else assert.deepEqual(sorted.map(r=>r.id),expected)}
 report.results.push({version:before?baseline:'working tree',medianMs:[...samples].sort((a,b)=>a-b)[2],samples})
}
await mkdir('docs/evidence/performance-review',{recursive:true});await writeFile('docs/evidence/performance-review/sort-benchmark.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2))
