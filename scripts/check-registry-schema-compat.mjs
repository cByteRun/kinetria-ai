import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import ts from 'typescript'
const source=await readFile(new URL('../lib/registry-data.ts',import.meta.url),'utf8')
const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText
const {readRegistry}=await import('data:text/javascript;base64,'+Buffer.from(compiled).toString('base64'))
function database(results){const reads=[];return {reads,from(table){assert.equal(table,'requests');return {select(fields){reads.push(fields);return this},order(){return this},returns(){return Promise.resolve(results.shift())}}}}}
const rows=[{id:'existing-request',title:'Existing request'}]
for(const code of ['42703','PGRST204']){
 const db=database([{data:null,error:{code,message:'column requests.origin does not exist'}},{data:rows,error:null}])
 assert.deepEqual((await readRegistry(db)).data,rows);assert.equal(db.reads.length,2);assert(db.reads[0].includes('origin'));assert(!db.reads[1].includes('origin'))
}
const current=database([{data:[{...rows[0],origin:'client'}],error:null}]);assert.equal((await readRegistry(current)).data[0].origin,'client');assert.equal(current.reads.length,1)
for(const error of [{code:'42501',message:'permission denied'},{code:'',message:'network failure'},{code:'42703',message:'column requests.title does not exist'}]){const db=database([{data:null,error}]);assert.equal((await readRegistry(db)).error,error);assert.equal(db.reads.length,1)}
console.log('PASS registry schema compatibility: old-schema records preserved, current origin retained, permissions/network/unrelated failures never masked')
